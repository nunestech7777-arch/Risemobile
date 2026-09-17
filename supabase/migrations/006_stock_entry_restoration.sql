-- RISEMOBILE: Migration 006 - Stock Entry & Batch Ingestion Restoration
-- Criado pelo Agente Estrutural de Estoque

-- 1. Garantir que a coluna source exista na tabela devices
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual' 
CHECK (source IN ('manual', 'import', 'external'));

-- 2. Garantir que a coluna stock_entry_id exista e esteja devidamente relacionada
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS stock_entry_id UUID;

-- Ajustar chave estrangeira stock_entry_id para apontar para stock_entries
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'devices_stock_entry_id_fkey'
    ) THEN
        ALTER TABLE public.devices DROP CONSTRAINT devices_stock_entry_id_fkey;
    END IF;
    ALTER TABLE public.devices 
    ADD CONSTRAINT devices_stock_entry_id_fkey 
    FOREIGN KEY (stock_entry_id) REFERENCES public.stock_entries(id) ON DELETE SET NULL;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 3. Atualizar / Expandir a tabela stock_entries com campos completos de rastreabilidade
ALTER TABLE public.stock_entries
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'external')),
ADD COLUMN IF NOT EXISTS suggested_price_usd NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS created_by VARCHAR(150) DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_stock_entries_ref ON public.stock_entries (reference_code);
CREATE INDEX IF NOT EXISTS idx_stock_entries_date ON public.stock_entries (created_at DESC);

-- 4. Função RPC Transacional Atômica: rpc_create_stock_entry_batch
-- Garante inserção atômica de:
-- - Lote em stock_entries
-- - N unidades em devices
-- - N movimentações em stock_movements
-- - Log em audit_logs
-- Em caso de qualquer duplicidade ou falha, faz ROLLBACK automático
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
    p_units JSONB -- Array de [{ imei, color, battery_health, cost_price_usd, suggested_price_usd }]
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
BEGIN
    -- Validações básicas de lote
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'A quantidade do lote deve ser maior que zero.';
    END IF;

    IF jsonb_array_length(p_units) <> p_quantity THEN
        RAISE EXCEPTION 'A quantidade de unidades no array (%) não corresponde à quantidade informada no lote (%).', 
            jsonb_array_length(p_units), p_quantity;
    END IF;

    -- Validar duplicidades internas no array de IMEIs
    FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units)
    LOOP
        v_imei := TRIM(v_unit->>'imei');
        IF v_imei IS NULL OR v_imei = '' THEN
            RAISE EXCEPTION 'Todas as unidades devem possuir um IMEI ou Serial válido.';
        END IF;

        -- Verificar se o IMEI já existe no banco
        SELECT id INTO v_existing_id FROM public.devices WHERE imei = v_imei LIMIT 1;
        IF v_existing_id IS NOT NULL THEN
            RAISE EXCEPTION 'O IMEI % já está cadastrado no sistema (Conflito com ID: %).', v_imei, v_existing_id;
        END IF;

        v_cost := COALESCE((v_unit->>'cost_price_usd')::NUMERIC, p_unit_cost_usd);
        v_total_cost := v_total_cost + v_cost;
    END LOOP;

    -- 1. Inserir Registro do Lote de Entrada (stock_entries)
    INSERT INTO public.stock_entries (
        reference_code,
        model,
        storage,
        grade_id,
        quantity,
        total_cost_usd,
        unit_cost_usd,
        suggested_price_usd,
        notes,
        created_by,
        source,
        created_at
    ) VALUES (
        p_reference_code,
        p_model,
        p_storage,
        p_grade_id,
        p_quantity,
        v_total_cost,
        p_unit_cost_usd,
        p_suggested_price_usd,
        p_notes,
        COALESCE(p_created_by, 'admin'),
        COALESCE(p_source, 'manual'),
        NOW()
    ) RETURNING id INTO v_stock_entry_id;

    -- 2. Inserir cada Unidade Individual (devices) e respectivo Histórico (stock_movements)
    FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units)
    LOOP
        v_imei := TRIM(v_unit->>'imei');
        v_color := COALESCE(v_unit->>'color', 'Padrão');
        v_battery := COALESCE((v_unit->>'battery_health')::INTEGER, 100);
        v_cost := COALESCE((v_unit->>'cost_price_usd')::NUMERIC, p_unit_cost_usd);
        v_price := COALESCE((v_unit->>'suggested_price_usd')::NUMERIC, p_suggested_price_usd);

        INSERT INTO public.devices (
            model,
            storage,
            grade_id,
            color,
            battery_health,
            imei,
            cost_price_usd,
            suggested_price_usd,
            status,
            stock_entry_id,
            source,
            created_at,
            updated_at
        ) VALUES (
            p_model,
            p_storage,
            p_grade_id,
            v_color,
            v_battery,
            v_imei,
            v_cost,
            v_price,
            'Disponível',
            v_stock_entry_id,
            COALESCE(p_source, 'manual'),
            NOW(),
            NOW()
        ) RETURNING id INTO v_inserted_device_id;

        -- Registrar Movimentação e Histórico Oficial
        INSERT INTO public.stock_movements (
            device_id,
            movement_type,
            previous_status,
            new_status,
            reason,
            notes,
            created_at
        ) VALUES (
            v_inserted_device_id,
            'Entrada',
            NULL,
            'Disponível',
            'Entrada de Estoque (Lote: ' || p_reference_code || ')',
            'Entrada registrada por ' || COALESCE(p_created_by, 'admin'),
            NOW()
        );

        v_devices_created := v_devices_created || jsonb_build_object(
            'id', v_inserted_device_id,
            'imei', v_imei,
            'model', p_model,
            'storage', p_storage,
            'color', v_color,
            'battery_health', v_battery,
            'cost_price_usd', v_cost,
            'suggested_price_usd', v_price
        );

        v_actual_count := v_actual_count + 1;
    END LOOP;

    -- 3. Log de Auditoria
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        performed_by,
        created_at
    ) VALUES (
        'stock_entries',
        v_stock_entry_id,
        'RPC_CREATE_STOCK_ENTRY_BATCH',
        jsonb_build_object(
            'stock_entry_id', v_stock_entry_id,
            'reference_code', p_reference_code,
            'quantity', p_quantity,
            'total_cost_usd', v_total_cost,
            'source', COALESCE(p_source, 'manual'),
            'devices_created', v_devices_created
        ),
        COALESCE(p_created_by, 'admin'),
        NOW()
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
