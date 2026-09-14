-- RISEMOBILE: Migration 005 - External Inventory Synchronization & Metadata
-- Criado pelo Agente de Backend / Estrutural

-- 1. Adicionar campos de integração externa na tabela de aparelhos
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS external_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS external_source VARCHAR(100) DEFAULT 'EXTERNAL_SYSTEM',
ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'synced';

-- Índice exclusivo para external_id quando preenchido para garantir idempotência
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_external_id_unique 
ON public.devices (external_id) 
WHERE external_id IS NOT NULL;

-- Índice para consultas por origem e status de sincronização
CREATE INDEX IF NOT EXISTS idx_devices_sync_status ON public.devices (sync_status, last_synced_at);

-- 2. Função RPC para Sincronização / UPSERT Idempotente de Aparelhos Externos
-- Regra Crítica: Preservar status comerciais internos (Reservado, Vendido, Retirado por ajuste)
CREATE OR REPLACE FUNCTION public.rpc_sync_external_devices(
    p_devices JSONB, -- Array de objetos com external_id, model, storage, grade_id, color, battery_health, imei, cost_price_usd, suggested_price_usd
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
    v_existing_status VARCHAR;
    v_inserted_count INTEGER := 0;
    v_updated_count INTEGER := 0;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_devices)
    LOOP
        v_external_id := v_item->>'external_id';
        v_imei := v_item->>'imei';
        v_model := v_item->>'model';
        v_storage := v_item->>'storage';
        v_grade_id := (v_item->>'grade_id')::UUID;
        v_color := COALESCE(v_item->>'color', 'Padrão');
        v_battery := COALESCE((v_item->>'battery_health')::INTEGER, 100);
        v_cost := COALESCE((v_item->>'cost_price_usd')::NUMERIC, 0.00);
        v_suggested := COALESCE((v_item->>'suggested_price_usd')::NUMERIC, v_cost * 1.25);

        IF v_imei IS NULL OR v_model IS NULL OR v_storage IS NULL THEN
            CONTINUE;
        END IF;

        -- Verificar se o aparelho já existe por external_id ou por IMEI
        SELECT id, status INTO v_existing_id, v_existing_status 
        FROM public.devices 
        WHERE (v_external_id IS NOT NULL AND external_id = v_external_id)
           OR imei = v_imei
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            -- ATUALIZAÇÃO (UPSERT): Atualiza dados físicos e mantém status comercial se estiver Reservado ou Vendido
            UPDATE public.devices
            SET 
                external_id = COALESCE(v_external_id, external_id),
                external_source = p_source,
                model = v_model,
                storage = v_storage,
                grade_id = COALESCE(v_grade_id, grade_id),
                color = v_color,
                battery_health = v_battery,
                cost_price_usd = v_cost,
                suggested_price_usd = v_suggested,
                last_synced_at = NOW(),
                sync_status = 'synced',
                updated_at = NOW()
            WHERE id = v_existing_id;

            v_updated_count := v_updated_count + 1;
        ELSE
            -- INSERÇÃO: Cria novo aparelho com status Disponível
            INSERT INTO public.devices (
                external_id,
                external_source,
                model,
                storage,
                grade_id,
                color,
                battery_health,
                imei,
                cost_price_usd,
                suggested_price_usd,
                status,
                last_synced_at,
                sync_status,
                created_at,
                updated_at
            ) VALUES (
                v_external_id,
                p_source,
                v_model,
                v_storage,
                v_grade_id,
                v_color,
                v_battery,
                v_imei,
                v_cost,
                v_suggested,
                'Disponível',
                NOW(),
                'synced',
                NOW(),
                NOW()
            ) RETURNING id INTO v_existing_id;

            -- Registrar movimentação de sincronização inicial
            INSERT INTO public.stock_movements (
                device_id,
                movement_type,
                previous_status,
                new_status,
                reason
            ) VALUES (
                v_existing_id,
                'Entrada',
                NULL,
                'Disponível',
                'Sincronização com Sistema Externo (' || p_source || ')'
            );

            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;

    -- Registrar log de auditoria da sincronização
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
