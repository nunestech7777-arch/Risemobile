-- ==============================================================================
-- RISEMOBILE: Migration 007 - RPCs Universais Aprimoradas e Políticas de Execução
-- Criado pela Arquitetura Multiagente de Auditoria Técnica
-- ==============================================================================

-- 1. RPC Universal para Reserva de Pedidos e Alocação de Aparelhos por Bateria
-- Suporta:
-- a) Pedido existente: passa p_order_id
-- b) Novo pedido atômico: passa p_retailer_id, p_items e p_notes (cria o pedido na hora)
-- Suporta tanto 'unit_price' quanto 'unit_price_usd' no array de itens
CREATE OR REPLACE FUNCTION public.rpc_reserve_devices_for_order(
    p_order_id UUID DEFAULT NULL,
    p_retailer_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::JSONB,
    p_notes TEXT DEFAULT '',
    p_order_number VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID := p_order_id;
    v_retailer_id UUID := p_retailer_id;
    v_item JSONB;
    v_model VARCHAR;
    v_storage VARCHAR;
    v_grade_id UUID;
    v_qty INTEGER;
    v_unit_price NUMERIC;
    v_order_item_id UUID;
    v_device RECORD;
    v_allocated_count INTEGER;
    v_total_amount NUMERIC := 0;
    v_total_commission NUMERIC := 0;
    v_commission_rate NUMERIC := 0;
    v_total_units INTEGER := 0;
    v_result_devices JSONB := '[]'::JSONB;
    v_order_num VARCHAR := p_order_number;
BEGIN
    -- Se p_order_id for informado, busca o lojista do pedido existente
    IF v_order_id IS NOT NULL THEN
        SELECT retailer_id INTO v_retailer_id FROM public.orders WHERE id = v_order_id;
        IF v_retailer_id IS NULL THEN
            RAISE EXCEPTION 'Pedido com ID % não encontrado.', v_order_id;
        END IF;
    ELSE
        -- Se p_order_id for nulo, p_retailer_id deve ser fornecido para criar o pedido
        IF v_retailer_id IS NULL THEN
            RAISE EXCEPTION 'ID do lojista ou ID do pedido deve ser fornecido.';
        END IF;
    END IF;

    -- Obter taxa de comissão por unidade do lojista
    SELECT COALESCE(commission_per_unit_usd, 0) INTO v_commission_rate 
    FROM public.retailers WHERE id = v_retailer_id;

    -- Calcular totais primeiro para criar o pedido com valores corretos se for novo
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 1);
        v_unit_price := COALESCE((v_item->>'unit_price_usd')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);
        v_total_amount := v_total_amount + (v_qty * v_unit_price);
        v_total_units := v_total_units + v_qty;
    END LOOP;

    v_total_commission := v_total_units * v_commission_rate;

    -- Se for um novo pedido, cria em public.orders
    IF v_order_id IS NULL THEN
        IF v_order_num IS NULL OR v_order_num = '' THEN
            v_order_num := 'PED-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
        END IF;

        INSERT INTO public.orders (
            order_number,
            retailer_id,
            status,
            total_amount_usd,
            paid_amount_usd,
            balance_due_usd,
            total_commission_usd,
            total_profit_usd,
            notes,
            reserved_at
        ) VALUES (
            v_order_num,
            v_retailer_id,
            'Reservado',
            v_total_amount,
            0,
            v_total_amount,
            v_total_commission,
            0,
            p_notes,
            NOW()
        )
        RETURNING id INTO v_order_id;
    ELSE
        -- Limpar itens e alocações anteriores caso seja uma re-reserva de pedido existente
        DELETE FROM public.order_device_allocations WHERE order_id = v_order_id;
        DELETE FROM public.order_items WHERE order_id = v_order_id;
        
        UPDATE public.orders 
        SET total_amount_usd = v_total_amount,
            balance_due_usd = v_total_amount - paid_amount_usd,
            total_commission_usd = v_total_commission,
            status = 'Reservado',
            updated_at = NOW()
        WHERE id = v_order_id;
    END IF;

    -- Iterar sobre os itens e alocar aparelhos disponíveis por maior bateria
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_model := v_item->>'model';
        v_storage := v_item->>'storage';
        v_grade_id := NULL;
        IF (v_item->>'grade_id') IS NOT NULL AND (v_item->>'grade_id') <> '' THEN
            v_grade_id := (v_item->>'grade_id')::UUID;
        END IF;
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 1);
        v_unit_price := COALESCE((v_item->>'unit_price_usd')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida (%) para o item % %', v_qty, v_model, v_storage;
        END IF;

        -- Inserir item do pedido
        INSERT INTO public.order_items (
            order_id, model, storage, grade_id, quantity, unit_price_usd, total_price_usd
        ) VALUES (
            v_order_id, v_model, v_storage, v_grade_id, v_qty, v_unit_price, (v_qty * v_unit_price)
        )
        RETURNING id INTO v_order_item_id;

        -- Selecionar aparelhos disponíveis ordenados por maior saúde de bateria com lock pessimista
        v_allocated_count := 0;
        FOR v_device IN 
            SELECT id, imei, battery_health, color, cost_price_usd
            FROM public.devices
            WHERE model = v_model 
              AND storage = v_storage 
              AND (v_grade_id IS NULL OR grade_id = v_grade_id)
              AND status = 'Disponível'
            ORDER BY battery_health DESC NULLS LAST, created_at ASC
            LIMIT v_qty
            FOR UPDATE SKIP LOCKED
        LOOP
            -- 1. Alocar aparelho ao pedido
            INSERT INTO public.order_device_allocations (order_id, order_item_id, device_id, status)
            VALUES (v_order_id, v_order_item_id, v_device.id, 'Reservado');

            -- 2. Atualizar status do dispositivo para Reservado
            UPDATE public.devices 
            SET status = 'Reservado', updated_at = NOW() 
            WHERE id = v_device.id;

            -- 3. Registrar movimentação de estoque
            INSERT INTO public.stock_movements (
                device_id, order_id, movement_type, previous_status, new_status, reason
            ) VALUES (
                v_device.id, v_order_id, 'Reserva', 'Disponível', 'Reservado', 'Reserva automática para pedido ' || v_order_num
            );

            v_result_devices := v_result_devices || jsonb_build_object(
                'device_id', v_device.id,
                'imei', v_device.imei,
                'model', v_model,
                'storage', v_storage,
                'color', v_device.color,
                'battery_health', v_device.battery_health,
                'cost_price_usd', v_device.cost_price_usd,
                'separated', false
            );

            v_allocated_count := v_allocated_count + 1;
        END LOOP;

        IF v_allocated_count < v_qty THEN
            RAISE EXCEPTION 'Estoque insuficiente para o modelo % % (solicitados: %, disponíveis: %)', 
                v_model, v_storage, v_qty, v_allocated_count;
        END IF;
    END LOOP;

    -- Registrar log de auditoria
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, performed_by)
    VALUES (
        'orders', 
        v_order_id, 
        'RESERVE_ORDER', 
        jsonb_build_object(
            'order_id', v_order_id, 
            'total_amount', v_total_amount, 
            'allocated_devices', v_result_devices
        ),
        'system'
    );

    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_id', v_order_id,
        'order_number', v_order_num,
        'retailer_id', v_retailer_id,
        'status', 'Reservado',
        'total_amount_usd', v_total_amount,
        'total_units', v_total_units,
        'total_commission_usd', v_total_commission,
        'allocated_devices', v_result_devices
    );
END;
$$;

-- Permissões de Execução
GRANT EXECUTE ON FUNCTION public.rpc_reserve_devices_for_order(UUID, UUID, JSONB, TEXT, VARCHAR) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_order(UUID, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finalize_order_sale(UUID, JSONB, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_adjust_device_stock(UUID, VARCHAR, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_stock_entry_batch(VARCHAR, VARCHAR, VARCHAR, UUID, INTEGER, NUMERIC, NUMERIC, TEXT, VARCHAR, VARCHAR, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_sync_external_devices(JSONB, VARCHAR, VARCHAR) TO authenticated, anon, service_role;
