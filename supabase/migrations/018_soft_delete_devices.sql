-- ==============================================================================
-- RISEMOBILE: Migration 018 - Apagar aparelho do estoque (soft delete rastreável)
--
-- Serve para corrigir CADASTRO FEITO POR ENGANO (ex.: unidades criadas por
-- quantidade sem IMEI). Não é ajuste de estoque: aparelho que já participou de
-- reserva, pedido, venda, devolução ou ajuste NÃO pode ser apagado.
--
--   * Soft delete: a linha continua no banco com deleted_at / deleted_by /
--     deletion_reason e status = 'Removido'. Como todas as RPCs e telas de estoque
--     só enxergam status = 'Disponível', o aparelho removido some da seleção
--     automática, de reservas, vendas e do estoque operacional.
--   * A regra vive no banco: rpc_delete_device valida vínculos, exige motivo,
--     exige administrador (quando a migration 015 está aplicada) e grava auditoria
--     (audit_logs, ação DEVICE_SOFT_DELETED). Não existe caminho de exclusão
--     pelo frontend que ignore essas regras.
--   * O IMEI de um aparelho removido volta a ficar livre para novo cadastro.
--
-- Seguro para rodar mais de uma vez. Rode no SQL Editor do Supabase (após a 017).
-- ==============================================================================

-- 1. Colunas de rastreabilidade ---------------------------------------------------
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(150),
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 2. Novo status terminal 'Removido' + consistência com deleted_at -----------------
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.devices'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%Retirado por ajuste%'
    LOOP
        EXECUTE format('ALTER TABLE public.devices DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_status_check;
ALTER TABLE public.devices ADD CONSTRAINT devices_status_check
    CHECK (status IN ('Disponível', 'Reservado', 'Vendido', 'Retirado por ajuste', 'Removido'));

ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_removed_consistency;
ALTER TABLE public.devices ADD CONSTRAINT devices_removed_consistency
    CHECK ((status = 'Removido') = (deleted_at IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_devices_deleted_at ON public.devices (deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. IMEI/Serial de aparelho removido volta a ficar livre --------------------------
DROP INDEX IF EXISTS public.unique_devices_imei_when_present;
CREATE UNIQUE INDEX unique_devices_imei_when_present
    ON public.devices (lower(imei))
    WHERE imei IS NOT NULL AND btrim(imei) <> '' AND deleted_at IS NULL;

-- 4. Entradas de lote: a checagem de IMEI existente ignora aparelhos removidos ------
CREATE OR REPLACE FUNCTION public.rpc_create_stock_entry_batch(
    p_reference_code VARCHAR,
    p_model VARCHAR,
    p_storage VARCHAR,
    p_grade_id UUID,
    p_quantity INTEGER,
    p_unit_cost_usd NUMERIC,
    p_suggested_price_usd NUMERIC,
    p_notes TEXT,
    p_created_by VARCHAR,
    p_source VARCHAR,
    p_units JSONB -- [{ imei?, color?, battery_health?, cost_price_usd?, suggested_price_usd? }]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_entry_id UUID;
    v_total_cost NUMERIC := 0;
    v_unit JSONB;
    v_imei VARCHAR;
    v_color VARCHAR;
    v_battery INTEGER;
    v_cost NUMERIC;
    v_price NUMERIC;
    v_inserted_device_id UUID;
    v_devices_created JSONB := '[]'::JSONB;
    v_actual_count INTEGER := 0;
    v_existing_id UUID;
    v_seen_imeis TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'A quantidade do lote deve ser maior que zero.';
    END IF;

    IF p_units IS NULL OR jsonb_array_length(p_units) <> p_quantity THEN
        RAISE EXCEPTION 'A quantidade de unidades no array (%) não corresponde à quantidade informada no lote (%).',
            COALESCE(jsonb_array_length(p_units), 0), p_quantity;
    END IF;

    -- IMEI/Serial é opcional; duplicidade só é checada quando informado
    FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units)
    LOOP
        v_imei := NULLIF(btrim(v_unit->>'imei'), '');
        IF v_imei IS NOT NULL THEN
            IF lower(v_imei) = ANY(v_seen_imeis) THEN
                RAISE EXCEPTION 'IMEI/Serial % está duplicado dentro do mesmo lote.', v_imei;
            END IF;
            v_seen_imeis := array_append(v_seen_imeis, lower(v_imei));

            SELECT id INTO v_existing_id FROM public.devices WHERE lower(imei) = lower(v_imei) AND deleted_at IS NULL LIMIT 1;
            IF v_existing_id IS NOT NULL THEN
                RAISE EXCEPTION 'O IMEI/Serial % já está cadastrado no sistema (Conflito com ID: %).', v_imei, v_existing_id;
            END IF;
        END IF;

        v_cost := COALESCE(NULLIF(v_unit->>'cost_price_usd', '')::NUMERIC, p_unit_cost_usd, 0);
        v_total_cost := v_total_cost + v_cost;
    END LOOP;

    INSERT INTO public.stock_entries (
        reference_code, model, storage, grade_id, quantity, total_cost_usd,
        unit_cost_usd, suggested_price_usd, notes, created_by, source, created_at
    ) VALUES (
        p_reference_code, p_model, p_storage, p_grade_id, p_quantity, v_total_cost,
        COALESCE(p_unit_cost_usd, 0), COALESCE(p_suggested_price_usd, 0), p_notes,
        COALESCE(p_created_by, 'admin'), COALESCE(p_source, 'manual'), NOW()
    ) RETURNING id INTO v_stock_entry_id;

    FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units)
    LOOP
        v_imei := NULLIF(btrim(v_unit->>'imei'), '');
        v_color := NULLIF(btrim(v_unit->>'color'), '');
        v_battery := NULLIF(v_unit->>'battery_health', '')::INTEGER;
        v_cost := COALESCE(NULLIF(v_unit->>'cost_price_usd', '')::NUMERIC, p_unit_cost_usd, 0);
        v_price := COALESCE(NULLIF(v_unit->>'suggested_price_usd', '')::NUMERIC, p_suggested_price_usd, 0);

        INSERT INTO public.devices (
            model, storage, grade_id, color, battery_health, imei,
            cost_price_usd, suggested_price_usd, status,
            stock_entry_id, source, created_at, updated_at
        ) VALUES (
            p_model, p_storage, p_grade_id, v_color, v_battery, v_imei,
            v_cost, v_price, 'Disponível',
            v_stock_entry_id, COALESCE(p_source, 'manual'), NOW(), NOW()
        ) RETURNING id INTO v_inserted_device_id;

        INSERT INTO public.stock_movements (device_id, movement_type, previous_status, new_status, reason, notes, created_at)
        VALUES (
            v_inserted_device_id, 'Entrada', NULL, 'Disponível',
            'Entrada de Estoque (Lote: ' || p_reference_code || ')',
            'Entrada registrada por ' || COALESCE(p_created_by, 'admin'),
            NOW()
        );

        v_devices_created := v_devices_created || jsonb_build_object(
            'id', v_inserted_device_id, 'imei', v_imei, 'model', p_model, 'storage', p_storage,
            'color', v_color, 'battery_health', v_battery,
            'cost_price_usd', v_cost, 'suggested_price_usd', v_price
        );
        v_actual_count := v_actual_count + 1;
    END LOOP;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, performed_by, created_at)
    VALUES (
        'stock_entries', v_stock_entry_id, 'RPC_CREATE_STOCK_ENTRY_BATCH',
        jsonb_build_object(
            'stock_entry_id', v_stock_entry_id, 'reference_code', p_reference_code,
            'quantity', p_quantity, 'total_cost_usd', v_total_cost,
            'source', COALESCE(p_source, 'manual'), 'devices_created', v_devices_created
        ),
        COALESCE(p_created_by, 'admin'), NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'stock_entry_id', v_stock_entry_id,
        'reference_code', p_reference_code,
        'quantity', v_actual_count,
        'total_cost_usd', v_total_cost,
        'devices', v_devices_created
    );
END;
$$;

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

    -- Validação global: só IMEI/Serial informado é conferido (duplicidade no lote e no sistema)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        IF v_item->'units' IS NULL OR jsonb_array_length(v_item->'units') = 0 THEN
            RAISE EXCEPTION 'O item % % não possui unidades.', v_item->>'model', v_item->>'storage';
        END IF;

        FOR v_unit IN SELECT * FROM jsonb_array_elements(v_item->'units')
        LOOP
            v_imei := NULLIF(btrim(v_unit->>'imei'), '');
            IF v_imei IS NULL THEN
                CONTINUE;
            END IF;

            IF lower(v_imei) = ANY(v_seen_imeis) THEN
                RAISE EXCEPTION 'IMEI/Serial % está duplicado entre itens/configurações do mesmo lote.', v_imei;
            END IF;
            v_seen_imeis := array_append(v_seen_imeis, lower(v_imei));

            SELECT id INTO v_existing_id FROM public.devices WHERE lower(imei) = lower(v_imei) AND deleted_at IS NULL LIMIT 1;
            IF v_existing_id IS NOT NULL THEN
                RAISE EXCEPTION 'O IMEI/Serial % já está cadastrado no sistema (Conflito com ID: %).', v_imei, v_existing_id;
            END IF;
        END LOOP;
    END LOOP;

    INSERT INTO public.stock_entries (reference_code, quantity, total_cost_usd, notes, created_by, source, created_at)
    VALUES (p_reference_code, 1, 0, p_notes, COALESCE(p_created_by, 'admin'), COALESCE(p_source, 'manual'), NOW())
    RETURNING id INTO v_stock_entry_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_unit_cost := COALESCE(NULLIF(v_item->>'unit_cost_usd', '')::NUMERIC, 0);
        v_item_suggested_price := COALESCE(NULLIF(v_item->>'suggested_price_usd', '')::NUMERIC, 0);
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
            v_imei := NULLIF(btrim(v_unit->>'imei'), '');
            v_color := NULLIF(btrim(v_unit->>'color'), '');
            v_battery := NULLIF(v_unit->>'battery_health', '')::INTEGER;
            v_cost := COALESCE(NULLIF(v_unit->>'cost_price_usd', '')::NUMERIC, v_item_unit_cost);
            v_price := COALESCE(NULLIF(v_unit->>'suggested_price_usd', '')::NUMERIC, v_item_suggested_price);

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

-- 5. Apagar aparelho (soft delete) ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_delete_device(
    p_device_id UUID,
    p_reason TEXT,
    p_deleted_by VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claims JSONB;
    v_role TEXT;
    v_email TEXT;
    v_is_admin BOOLEAN := TRUE;
    v_device RECORD;
    v_reason TEXT;
    v_actor VARCHAR;
    v_grade_name TEXT;
    v_linked BOOLEAN := FALSE;
    v_returned BOOLEAN := FALSE;
    v_deleted_at TIMESTAMPTZ := NOW();
BEGIN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
    v_role := v_claims ->> 'role';
    v_email := v_claims ->> 'email';

    -- Somente administrador (quando o controle de acesso da migration 015 existe)
    IF to_regprocedure('public.is_admin()') IS NOT NULL AND COALESCE(v_role, '') <> 'service_role' THEN
        EXECUTE 'SELECT public.is_admin()' INTO v_is_admin;
        IF NOT COALESCE(v_is_admin, FALSE) THEN
            RAISE EXCEPTION 'Apenas administradores podem apagar aparelhos do estoque.';
        END IF;
    END IF;

    v_reason := NULLIF(btrim(p_reason), '');
    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'Informe o motivo da exclusão do aparelho.';
    END IF;

    SELECT * INTO v_device FROM public.devices WHERE id = p_device_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aparelho não encontrado.';
    END IF;
    IF v_device.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Este aparelho já foi removido do estoque.';
    END IF;

    -- Vínculos críticos: reserva, pedido, venda, devolução, ajuste, movimentação comercial.
    -- (pagamentos, parcelas e comissões são ligados ao pedido, que exige alocação do aparelho)
    IF to_regclass('public.sale_return_items') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.sale_return_items WHERE device_id = $1)'
            INTO v_returned USING p_device_id;
    END IF;

    v_linked := v_device.status <> 'Disponível'
        OR v_returned
        OR EXISTS (SELECT 1 FROM public.order_device_allocations WHERE device_id = p_device_id)
        OR EXISTS (SELECT 1 FROM public.stock_adjustments WHERE device_id = p_device_id)
        OR EXISTS (SELECT 1 FROM public.stock_movements WHERE device_id = p_device_id AND movement_type <> 'Entrada');

    IF v_linked THEN
        RAISE EXCEPTION 'Este aparelho possui vínculos com pedido, venda, reserva ou movimentações financeiras. Para preservar o histórico e a integridade dos dados, ele não pode ser apagado. Use ajuste de estoque ou cancele o vínculo relacionado.';
    END IF;

    v_actor := COALESCE(NULLIF(v_email, ''), NULLIF(btrim(p_deleted_by), ''), 'admin');

    UPDATE public.devices
    SET status = 'Removido',
        deleted_at = v_deleted_at,
        deleted_by = v_actor,
        deletion_reason = v_reason,
        updated_at = v_deleted_at
    WHERE id = p_device_id;

    SELECT name INTO v_grade_name FROM public.grades WHERE id = v_device.grade_id;

    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, performed_by, created_at)
    VALUES (
        'devices', p_device_id, 'DEVICE_SOFT_DELETED',
        jsonb_build_object(
            'model', v_device.model, 'storage', v_device.storage,
            'grade_id', v_device.grade_id, 'grade', v_grade_name,
            'imei', v_device.imei, 'color', v_device.color, 'battery_health', v_device.battery_health,
            'cost_price_usd', v_device.cost_price_usd, 'suggested_price_usd', v_device.suggested_price_usd,
            'status', v_device.status, 'stock_entry_id', v_device.stock_entry_id
        ),
        jsonb_build_object('status', 'Removido', 'deleted_at', v_deleted_at, 'deleted_by', v_actor, 'deletion_reason', v_reason),
        v_actor, v_deleted_at
    );

    RETURN jsonb_build_object('success', true, 'device_id', p_device_id, 'deleted_at', v_deleted_at, 'deleted_by', v_actor);
END;
$$;

-- Nova função: fechada para anônimos (padrão da migration 016)
REVOKE ALL ON FUNCTION public.rpc_delete_device(UUID, TEXT, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_delete_device(UUID, TEXT, VARCHAR) TO authenticated, service_role;
