-- ==============================================================================
-- RISEMOBILE: Migration 017 - IMEI/Serial, cor e bateria passam a ser OPCIONAIS
--
-- Regra de negócio: o administrador cadastra aparelhos informando apenas
-- modelo + armazenamento + grade + quantidade. IMEI/serial, cor, saúde da
-- bateria, custo e preço individuais podem ser preenchidos depois.
--
--   * O identificador real do aparelho é SEMPRE o id interno (devices.id).
--     Reservas, vendas, ajustes, devoluções e movimentações já usam device_id.
--   * IMEI e serial compartilham a mesma coluna (devices.imei, exibida na tela
--     como "IMEI / Serial"). Ela pode ficar NULL; quando preenchida, é ÚNICA
--     (sem diferenciar maiúsculas/minúsculas).
--   * cost_price_usd / suggested_price_usd continuam NOT NULL DEFAULT 0:
--     "não informado" = 0, para não quebrar cálculo de lucro/faturamento.
--
-- Seguro para rodar mais de uma vez. Rode no SQL Editor do Supabase.
-- ==============================================================================

-- 0. Pré-requisitos (idempotentes) -----------------------------------------------
-- As RPCs abaixo gravam nestas colunas/tabelas (criadas pelas migrations 005, 006 e
-- 011). Garante que existam, para a função nunca falhar em tempo de execução.
DO $$
BEGIN
    IF to_regclass('public.stock_entry_items') IS NULL THEN
        RAISE EXCEPTION 'A tabela stock_entry_items não existe. Aplique antes a migration 011_stock_entry_multi_item.sql.';
    END IF;
END $$;

ALTER TABLE public.stock_entries
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'external')),
    ADD COLUMN IF NOT EXISTS suggested_price_usd NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(150) DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'external')),
    ADD COLUMN IF NOT EXISTS stock_entry_item_id UUID REFERENCES public.stock_entry_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS external_source VARCHAR(100) DEFAULT 'EXTERNAL_SYSTEM',
    ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'synced';

-- 1. Colunas opcionais ----------------------------------------------------------
ALTER TABLE public.devices ALTER COLUMN imei DROP NOT NULL;
ALTER TABLE public.devices ALTER COLUMN color DROP NOT NULL;
ALTER TABLE public.devices ALTER COLUMN battery_health DROP NOT NULL;
-- (o CHECK battery_health BETWEEN 0 AND 100 continua valendo quando informado)

ALTER TABLE public.devices ALTER COLUMN cost_price_usd SET DEFAULT 0;
ALTER TABLE public.devices ALTER COLUMN suggested_price_usd SET DEFAULT 0;

-- Correção de bug prévio: rpc_create_stock_entry_batch_multi grava a ação
-- 'RPC_CREATE_STOCK_ENTRY_BATCH_MULTI' (34 caracteres) em audit_logs.action,
-- que era VARCHAR(30) -> "value too long" derrubava a entrada de estoque inteira.
ALTER TABLE public.audit_logs ALTER COLUMN action TYPE VARCHAR(60);

-- Snapshot de devolução: o aparelho devolvido pode não ter IMEI
DO $$
BEGIN
    IF to_regclass('public.sale_return_items') IS NOT NULL THEN
        ALTER TABLE public.sale_return_items ALTER COLUMN imei DROP NOT NULL;
    END IF;
END $$;

-- 2. Normalização: string vazia / só espaços vira NULL --------------------------
CREATE OR REPLACE FUNCTION public.normalize_device_optional_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.imei := NULLIF(btrim(NEW.imei), '');
    NEW.color := NULLIF(btrim(NEW.color), '');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devices_normalize_optional_fields ON public.devices;
CREATE TRIGGER trg_devices_normalize_optional_fields
    BEFORE INSERT OR UPDATE ON public.devices
    FOR EACH ROW EXECUTE FUNCTION public.normalize_device_optional_fields();

UPDATE public.devices SET imei = NULL WHERE imei IS NOT NULL AND btrim(imei) = '';
UPDATE public.devices SET color = NULL WHERE color IS NOT NULL AND btrim(color) = '';

-- 3. UNIQUE simples -> índice único PARCIAL (único apenas quando informado) -----
DO $$
DECLARE
    c RECORD;
    v_dup TEXT;
BEGIN
    -- Remove qualquer UNIQUE simples que cubra somente a coluna imei
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        WHERE con.conrelid = 'public.devices'::regclass
          AND con.contype = 'u'
          AND (SELECT array_agg(att.attname::text)
               FROM unnest(con.conkey) k
               JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k) = ARRAY['imei']
    LOOP
        EXECUTE format('ALTER TABLE public.devices DROP CONSTRAINT %I', c.conname);
    END LOOP;

    -- Pré-checagem: o índice novo ignora maiúsculas/minúsculas; falha com mensagem clara
    SELECT string_agg(k, ', ') INTO v_dup
    FROM (
        SELECT lower(imei) AS k
        FROM public.devices
        WHERE imei IS NOT NULL
        GROUP BY lower(imei)
        HAVING count(*) > 1
        LIMIT 10
    ) d;
    IF v_dup IS NOT NULL THEN
        RAISE EXCEPTION 'Existem IMEIs/seriais duplicados (ignorando maiúsculas/minúsculas): %. Corrija antes de aplicar a migration 017.', v_dup;
    END IF;
END $$;

DROP INDEX IF EXISTS public.unique_devices_imei_when_present;
CREATE UNIQUE INDEX unique_devices_imei_when_present
    ON public.devices (lower(imei))
    WHERE imei IS NOT NULL AND btrim(imei) <> '';

-- 4. rpc_create_stock_entry_batch (lote de configuração única) -------------------
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

            SELECT id INTO v_existing_id FROM public.devices WHERE lower(imei) = lower(v_imei) LIMIT 1;
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

-- 5. rpc_create_stock_entry_batch_multi (lote com N itens/modelos) ---------------
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

            SELECT id INTO v_existing_id FROM public.devices WHERE lower(imei) = lower(v_imei) LIMIT 1;
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

-- 6. rpc_sync_external_devices: aparelho externo pode vir sem IMEI (usa external_id)
CREATE OR REPLACE FUNCTION public.rpc_sync_external_devices(
    p_devices JSONB,
    p_source VARCHAR DEFAULT 'EXTERNAL_SYSTEM'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_external_id VARCHAR;
    v_imei VARCHAR;
    v_model VARCHAR;
    v_storage VARCHAR;
    v_grade_id UUID;
    v_color VARCHAR;
    v_battery INTEGER;
    v_cost NUMERIC;
    v_suggested NUMERIC;
    v_existing_id UUID;
    v_inserted_count INTEGER := 0;
    v_updated_count INTEGER := 0;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_devices)
    LOOP
        v_external_id := NULLIF(btrim(v_item->>'external_id'), '');
        v_imei := NULLIF(btrim(v_item->>'imei'), '');
        v_model := v_item->>'model';
        v_storage := v_item->>'storage';
        v_grade_id := (v_item->>'grade_id')::UUID;
        v_color := NULLIF(btrim(v_item->>'color'), '');
        v_battery := NULLIF(v_item->>'battery_health', '')::INTEGER;
        v_cost := COALESCE(NULLIF(v_item->>'cost_price_usd', '')::NUMERIC, 0.00);
        v_suggested := COALESCE(NULLIF(v_item->>'suggested_price_usd', '')::NUMERIC, v_cost * 1.25);

        -- Sem IMEI, o aparelho externo só é identificável pelo external_id
        IF (v_imei IS NULL AND v_external_id IS NULL) OR v_model IS NULL OR v_storage IS NULL THEN
            CONTINUE;
        END IF;

        v_existing_id := NULL;
        SELECT id INTO v_existing_id
        FROM public.devices
        WHERE (v_external_id IS NOT NULL AND external_id = v_external_id)
           OR (v_imei IS NOT NULL AND lower(imei) = lower(v_imei))
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            -- UPSERT: atualiza dados físicos; NUNCA altera o status comercial interno
            UPDATE public.devices
            SET
                external_id = COALESCE(v_external_id, external_id),
                external_source = p_source,
                imei = COALESCE(imei, v_imei),
                model = v_model,
                storage = v_storage,
                grade_id = COALESCE(v_grade_id, grade_id),
                color = COALESCE(v_color, color),
                battery_health = COALESCE(v_battery, battery_health),
                cost_price_usd = v_cost,
                suggested_price_usd = v_suggested,
                last_synced_at = NOW(),
                sync_status = 'synced',
                updated_at = NOW()
            WHERE id = v_existing_id;

            v_updated_count := v_updated_count + 1;
        ELSE
            INSERT INTO public.devices (
                external_id, external_source, model, storage, grade_id, color,
                battery_health, imei, cost_price_usd, suggested_price_usd, status,
                last_synced_at, sync_status, created_at, updated_at
            ) VALUES (
                v_external_id, p_source, v_model, v_storage, v_grade_id, v_color,
                v_battery, v_imei, v_cost, v_suggested, 'Disponível',
                NOW(), 'synced', NOW(), NOW()
            ) RETURNING id INTO v_existing_id;

            INSERT INTO public.stock_movements (device_id, movement_type, previous_status, new_status, reason)
            VALUES (v_existing_id, 'Entrada', NULL, 'Disponível', 'Sincronização com Sistema Externo (' || p_source || ')');

            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_data)
    VALUES ('devices', NULL, 'RPC_SYNC_EXTERNAL_DEVICES', jsonb_build_object(
        'source', p_source,
        'inserted_count', v_inserted_count,
        'updated_count', v_updated_count,
        'total_processed', v_inserted_count + v_updated_count
    ));

    RETURN jsonb_build_object(
        'success', true,
        'inserted_count', v_inserted_count,
        'updated_count', v_updated_count,
        'total_processed', v_inserted_count + v_updated_count
    );
END;
$$;

-- CREATE OR REPLACE mantém os GRANTs já existentes (inclusive o fechamento da
-- migration 016); nenhuma permissão é ampliada aqui.
