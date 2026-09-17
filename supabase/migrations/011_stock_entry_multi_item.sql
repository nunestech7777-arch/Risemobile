-- ==============================================================================
-- RISEMOBILE: Migration 011 - Lote de Entrada com Múltiplos Modelos/Itens
-- Um único lote (stock_entries) passa a poder conter N itens/configurações
-- (stock_entry_items), cada um com seu próprio modelo, armazenamento, grade,
-- custo e preço — e cada aparelho fica ligado tanto ao lote quanto ao item
-- de origem.
-- ==============================================================================

-- 1. stock_entries deixa de exigir uma única configuração — vira só o cabeçalho
--    (código, observações, quantidade/custo totais agregados). Continua
--    funcionando para lotes antigos de configuração única (model/storage
--    preenchidos), mas passam a ser opcionais para os novos lotes multi-item.
ALTER TABLE public.stock_entries ALTER COLUMN model DROP NOT NULL;
ALTER TABLE public.stock_entries ALTER COLUMN storage DROP NOT NULL;
ALTER TABLE public.stock_entries ALTER COLUMN unit_cost_usd DROP NOT NULL;

-- 2. Itens/configurações do lote
CREATE TABLE IF NOT EXISTS public.stock_entry_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_entry_id UUID NOT NULL REFERENCES public.stock_entries(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    storage VARCHAR(50) NOT NULL,
    grade_id UUID NOT NULL REFERENCES public.grades(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost_usd >= 0),
    suggested_price_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (suggested_price_usd >= 0),
    total_cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_cost_usd >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_entry_items_entry ON public.stock_entry_items (stock_entry_id);

ALTER TABLE public.stock_entry_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access dev" ON public.stock_entry_items;
CREATE POLICY "Allow anon full access dev" ON public.stock_entry_items FOR ALL USING (true) WITH CHECK (true);

-- 3. Cada aparelho passa a identificar também o ITEM de origem (além do lote)
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS stock_entry_item_id UUID;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'devices_stock_entry_item_id_fkey'
    ) THEN
        ALTER TABLE public.devices
        ADD CONSTRAINT devices_stock_entry_item_id_fkey
        FOREIGN KEY (stock_entry_item_id) REFERENCES public.stock_entry_items(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. RPC TRANSACIONAL: cria 1 lote com N itens/configurações e todos os aparelhos
-- p_items: [{ model, storage, grade_id, unit_cost_usd, suggested_price_usd,
--             units: [{ imei, color, battery_health, cost_price_usd, suggested_price_usd }] }]
CREATE OR REPLACE FUNCTION public.rpc_create_stock_entry_batch_multi(
    p_reference_code VARCHAR,
    p_notes TEXT,
    p_created_by VARCHAR,
    p_source VARCHAR,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_entry_id UUID;
    v_item JSONB;
    v_unit JSONB;
    v_item_id UUID;
    v_imei VARCHAR;
    v_color VARCHAR;
    v_battery INTEGER;
    v_cost NUMERIC;
    v_price NUMERIC;
    v_item_unit_cost NUMERIC;
    v_item_suggested_price NUMERIC;
    v_item_total_cost NUMERIC;
    v_grand_total_cost NUMERIC := 0;
    v_grand_total_qty INTEGER := 0;
    v_inserted_device_id UUID;
    v_existing_id UUID;
    v_seen_imeis TEXT[] := ARRAY[]::TEXT[];
    v_items_result JSONB := '[]'::JSONB;
    v_item_devices JSONB;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'O lote precisa conter ao menos um item/configuração.';
    END IF;

    -- Validação global de IMEIs: duplicidade dentro do próprio item, entre itens
    -- do mesmo lote, e contra aparelhos já existentes no sistema.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        FOR v_unit IN SELECT * FROM jsonb_array_elements(v_item->'units')
        LOOP
            v_imei := TRIM(v_unit->>'imei');
            IF v_imei IS NULL OR v_imei = '' THEN
                RAISE EXCEPTION 'Todas as unidades devem possuir um IMEI ou Serial válido.';
            END IF;

            IF v_imei = ANY(v_seen_imeis) THEN
                RAISE EXCEPTION 'IMEI % está duplicado entre itens/configurações do mesmo lote.', v_imei;
            END IF;
            v_seen_imeis := array_append(v_seen_imeis, v_imei);

            SELECT id INTO v_existing_id FROM public.devices WHERE imei = v_imei LIMIT 1;
            IF v_existing_id IS NOT NULL THEN
                RAISE EXCEPTION 'O IMEI % já está cadastrado no sistema (Conflito com ID: %).', v_imei, v_existing_id;
            END IF;
        END LOOP;
    END LOOP;

    -- 1. Cabeçalho do lote (quantity/total_cost_usd agregados, preenchidos ao final)
    INSERT INTO public.stock_entries (reference_code, quantity, total_cost_usd, notes, created_by, source, created_at)
    VALUES (p_reference_code, 1, 0, p_notes, COALESCE(p_created_by, 'admin'), COALESCE(p_source, 'manual'), NOW())
    RETURNING id INTO v_stock_entry_id;

    -- 2. Cada item/configuração + suas unidades
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_unit_cost := COALESCE((v_item->>'unit_cost_usd')::NUMERIC, 0);
        v_item_suggested_price := COALESCE((v_item->>'suggested_price_usd')::NUMERIC, 0);
        v_item_total_cost := 0;
        v_item_devices := '[]'::JSONB;

        INSERT INTO public.stock_entry_items (stock_entry_id, model, storage, grade_id, quantity, unit_cost_usd, suggested_price_usd, total_cost_usd)
        VALUES (
            v_stock_entry_id,
            v_item->>'model',
            v_item->>'storage',
            (v_item->>'grade_id')::UUID,
            jsonb_array_length(v_item->'units'),
            v_item_unit_cost,
            v_item_suggested_price,
            0
        ) RETURNING id INTO v_item_id;

        FOR v_unit IN SELECT * FROM jsonb_array_elements(v_item->'units')
        LOOP
            v_imei := TRIM(v_unit->>'imei');
            v_color := COALESCE(v_unit->>'color', 'Padrão');
            v_battery := COALESCE((v_unit->>'battery_health')::INTEGER, 100);
            v_cost := COALESCE((v_unit->>'cost_price_usd')::NUMERIC, v_item_unit_cost);
            v_price := COALESCE((v_unit->>'suggested_price_usd')::NUMERIC, v_item_suggested_price);

            INSERT INTO public.devices (
                model, storage, grade_id, color, battery_health, imei,
                cost_price_usd, suggested_price_usd, status,
                stock_entry_id, stock_entry_item_id, source, created_at, updated_at
            ) VALUES (
                v_item->>'model', v_item->>'storage', (v_item->>'grade_id')::UUID, v_color, v_battery, v_imei,
                v_cost, v_price, 'Disponível',
                v_stock_entry_id, v_item_id, COALESCE(p_source, 'manual'), NOW(), NOW()
            ) RETURNING id INTO v_inserted_device_id;

            INSERT INTO public.stock_movements (device_id, movement_type, previous_status, new_status, reason, notes, created_at)
            VALUES (
                v_inserted_device_id, 'Entrada', NULL, 'Disponível',
                'Entrada de Estoque (Lote: ' || p_reference_code || ' — ' || (v_item->>'model') || ' ' || (v_item->>'storage') || ')',
                'Entrada registrada por ' || COALESCE(p_created_by, 'admin'),
                NOW()
            );

            v_item_total_cost := v_item_total_cost + v_cost;
            v_item_devices := v_item_devices || jsonb_build_object(
                'id', v_inserted_device_id, 'imei', v_imei, 'color', v_color,
                'battery_health', v_battery, 'cost_price_usd', v_cost, 'suggested_price_usd', v_price
            );
        END LOOP;

        UPDATE public.stock_entry_items SET total_cost_usd = v_item_total_cost WHERE id = v_item_id;

        v_grand_total_cost := v_grand_total_cost + v_item_total_cost;
        v_grand_total_qty := v_grand_total_qty + jsonb_array_length(v_item->'units');

        v_items_result := v_items_result || jsonb_build_object(
            'item_id', v_item_id,
            'model', v_item->>'model',
            'storage', v_item->>'storage',
            'grade_id', v_item->>'grade_id',
            'quantity', jsonb_array_length(v_item->'units'),
            'total_cost_usd', v_item_total_cost,
            'devices', v_item_devices
        );
    END LOOP;

    UPDATE public.stock_entries SET quantity = v_grand_total_qty, total_cost_usd = v_grand_total_cost WHERE id = v_stock_entry_id;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, performed_by, created_at)
    VALUES (
        'stock_entries', v_stock_entry_id, 'RPC_CREATE_STOCK_ENTRY_BATCH_MULTI',
        jsonb_build_object('stock_entry_id', v_stock_entry_id, 'reference_code', p_reference_code, 'items', v_items_result),
        COALESCE(p_created_by, 'admin'), NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'stock_entry_id', v_stock_entry_id,
        'reference_code', p_reference_code,
        'total_items', jsonb_array_length(p_items),
        'total_quantity', v_grand_total_qty,
        'total_cost_usd', v_grand_total_cost,
        'items', v_items_result
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_stock_entry_batch_multi(VARCHAR, TEXT, VARCHAR, VARCHAR, JSONB) TO authenticated, anon, service_role;
