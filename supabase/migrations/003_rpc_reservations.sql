-- RISEMOBILE: Migration 003 - RPCs & Stored Procedures Transacionais
-- Criado pelo Agente de Backend e Supabase

-- 1. Função RPC para Reserva Automática e Atômica de Aparelhos em um Pedido
CREATE OR REPLACE FUNCTION public.rpc_reserve_devices_for_order(
    p_order_id UUID,
    p_items JSONB -- Array de [{ "model": "iPhone 13", "storage": "128GB", "grade_id": "uuid", "quantity": 3, "unit_price": 450 }]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
    v_retailer_id UUID;
    v_total_units INTEGER := 0;
    v_result_devices JSONB := '[]'::JSONB;
BEGIN
    -- Obter lojista e taxa de comissão do pedido
    SELECT retailer_id INTO v_retailer_id FROM public.orders WHERE id = p_order_id;
    IF v_retailer_id IS NULL THEN
        RAISE EXCEPTION 'Pedido não encontrado: %', p_order_id;
    END IF;

    SELECT COALESCE(commission_per_unit_usd, 0) INTO v_commission_rate 
    FROM public.retailers WHERE id = v_retailer_id;

    -- Limpar itens e alocações anteriores caso seja uma re-reserva
    DELETE FROM public.order_device_allocations WHERE order_id = p_order_id;
    DELETE FROM public.order_items WHERE order_id = p_order_id;

    -- Iterar sobre os itens solicitados
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_model := v_item->>'model';
        v_storage := v_item->>'storage';
        v_grade_id := (v_item->>'grade_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;
        v_unit_price := (v_item->>'unit_price')::NUMERIC;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida para o item % %', v_model, v_storage;
        END IF;

        -- Criar item do pedido
        INSERT INTO public.order_items (order_id, model, storage, grade_id, quantity, unit_price_usd, total_price_usd)
        VALUES (p_order_id, v_model, v_storage, v_grade_id, v_qty, v_unit_price, (v_qty * v_unit_price))
        RETURNING id INTO v_order_item_id;

        v_total_amount := v_total_amount + (v_qty * v_unit_price);
        v_total_units := v_total_units + v_qty;

        -- Selecionar aparelhos disponíveis com lock pessimista (FOR UPDATE)
        v_allocated_count := 0;
        FOR v_device IN 
            SELECT id, imei, battery_health, color, cost_price_usd
            FROM public.devices
            WHERE model = v_model 
              AND storage = v_storage 
              AND grade_id = v_grade_id 
              AND status = 'Disponível'
            ORDER BY battery_health DESC, created_at ASC
            LIMIT v_qty
            FOR UPDATE SKIP LOCKED
        LOOP
            -- Alterar status do aparelho para Reservado
            UPDATE public.devices 
            SET status = 'Reservado', updated_at = NOW() 
            WHERE id = v_device.id;

            -- Inserir alocação única
            INSERT INTO public.order_device_allocations (order_id, order_item_id, device_id, status)
            VALUES (p_order_id, v_order_item_id, v_device.id, 'Reservado');

            -- Registrar movimentação
            INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason)
            VALUES (v_device.id, p_order_id, 'Reserva', 'Disponível', 'Reservado', 'Reserva automática do pedido ' || p_order_id);

            -- Adicionar ao resultado retornado
            v_result_devices := v_result_devices || jsonb_build_object(
                'device_id', v_device.id,
                'imei', v_device.imei,
                'model', v_model,
                'storage', v_storage,
                'battery_health', v_device.battery_health,
                'color', v_device.color
            );

            v_allocated_count := v_allocated_count + 1;
        END LOOP;

        -- Validação estrita: se não encontrou todas as unidades necessárias, reverte tudo
        IF v_allocated_count < v_qty THEN
            RAISE EXCEPTION 'Estoque insuficiente para % % (solicitado: %, disponível: %)', 
                v_model, v_storage, v_qty, v_allocated_count;
        END IF;
    END LOOP;

    v_total_commission := v_total_units * v_commission_rate;

    -- Atualizar pedido com totais e status Reservado
    UPDATE public.orders
    SET status = 'Reservado',
        total_amount_usd = v_total_amount,
        balance_due_usd = v_total_amount - paid_amount_usd,
        total_commission_usd = v_total_commission,
        reserved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Atualizar ou inserir registro de comissão
    DELETE FROM public.commissions WHERE order_id = p_order_id;
    IF v_total_commission > 0 THEN
        INSERT INTO public.commissions (order_id, retailer_id, total_units, rate_per_unit_usd, total_commission_usd)
        VALUES (p_order_id, v_retailer_id, v_total_units, v_commission_rate, v_total_commission);
    END IF;

    -- Log de Auditoria
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data)
    VALUES ('orders', p_order_id, 'RPC_RESERVE', jsonb_build_object(
        'total_amount', v_total_amount,
        'units_allocated', v_total_units,
        'allocated_devices', v_result_devices
    ));

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'total_amount_usd', v_total_amount,
        'total_units', v_total_units,
        'allocated_devices', v_result_devices
    );
END;
$$;

-- 2. Função RPC para Cancelamento do Pedido e Liberação Total do Estoque
CREATE OR REPLACE FUNCTION public.rpc_cancel_order(
    p_order_id UUID,
    p_reason TEXT DEFAULT 'Cancelado pelo usuário'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alloc RECORD;
    v_released_count INTEGER := 0;
BEGIN
    -- Selecionar todos os dispositivos vinculados ao pedido
    FOR v_alloc IN 
        SELECT device_id FROM public.order_device_allocations WHERE order_id = p_order_id
    LOOP
        -- Retornar aparelho para Disponível
        UPDATE public.devices 
        SET status = 'Disponível', updated_at = NOW() 
        WHERE id = v_alloc.device_id;

        -- Registrar histórico de movimentação
        INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason)
        VALUES (v_alloc.device_id, p_order_id, 'Cancelamento de Reserva', 'Reservado', 'Disponível', p_reason);

        v_released_count := v_released_count + 1;
    END LOOP;

    -- Remover alocações
    DELETE FROM public.order_device_allocations WHERE order_id = p_order_id;

    -- Atualizar status do pedido
    UPDATE public.orders
    SET status = 'Cancelado',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Log de Auditoria
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data)
    VALUES ('orders', p_order_id, 'RPC_CANCEL', jsonb_build_object(
        'released_devices_count', v_released_count,
        'reason', p_reason
    ));

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'released_count', v_released_count
    );
END;
$$;

-- 3. Função RPC para Finalização de Venda com Pagamentos, Parcelas e Cálculo de Lucro Real
CREATE OR REPLACE FUNCTION public.rpc_finalize_order_sale(
    p_order_id UUID,
    p_payments JSONB,     -- Array de pagamentos efetuados [{ "amount_usd": 1000, "method": "PIX", "exchange_rate": 5.50 }]
    p_installments JSONB  -- Array de parcelas [{ "number": 1, "amount_usd": 500, "due_date": "2026-10-15" }]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_alloc RECORD;
    v_payment JSONB;
    v_installment JSONB;
    v_total_cost NUMERIC := 0;
    v_total_profit NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_device_cost NUMERIC;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido % não encontrado', p_order_id;
    END IF;

    -- Processar dispositivos vinculados e calcular custo real
    FOR v_alloc IN 
        SELECT oda.device_id, d.cost_price_usd 
        FROM public.order_device_allocations oda
        JOIN public.devices d ON d.id = oda.device_id
        WHERE oda.order_id = p_order_id
    LOOP
        v_total_cost := v_total_cost + v_alloc.cost_price_usd;

        -- Alterar status do aparelho para Vendido
        UPDATE public.devices 
        SET status = 'Vendido', updated_at = NOW() 
        WHERE id = v_alloc.device_id;

        -- Atualizar alocação para Vendido
        UPDATE public.order_device_allocations
        SET status = 'Vendido'
        WHERE order_id = p_order_id AND device_id = v_alloc.device_id;

        -- Registrar movimentação
        INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason)
        VALUES (v_alloc.device_id, p_order_id, 'Venda', 'Reservado', 'Vendido', 'Venda finalizada no pedido ' || v_order.order_number);
    END LOOP;

    -- Inserir Pagamentos
    IF p_payments IS NOT NULL AND jsonb_array_length(p_payments) > 0 THEN
        FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
        LOOP
            INSERT INTO public.payments (
                order_id, retailer_id, amount_usd, amount_brl, exchange_rate, payment_method, notes
            ) VALUES (
                p_order_id, 
                v_order.retailer_id, 
                (v_payment->>'amount_usd')::NUMERIC,
                COALESCE((v_payment->>'amount_brl')::NUMERIC, (v_payment->>'amount_usd')::NUMERIC * COALESCE((v_payment->>'exchange_rate')::NUMERIC, 1.0)),
                COALESCE((v_payment->>'exchange_rate')::NUMERIC, 1.0000),
                v_payment->>'method',
                v_payment->>'notes'
            );

            v_total_paid := v_total_paid + (v_payment->>'amount_usd')::NUMERIC;
        END LOOP;
    END IF;

    -- Inserir Parcelas (Contas a Receber)
    IF p_installments IS NOT NULL AND jsonb_array_length(p_installments) > 0 THEN
        FOR v_installment IN SELECT * FROM jsonb_array_elements(p_installments)
        LOOP
            INSERT INTO public.installments (
                order_id, retailer_id, installment_number, amount_usd, due_date, status
            ) VALUES (
                p_order_id,
                v_order.retailer_id,
                (v_installment->>'number')::INTEGER,
                (v_installment->>'amount_usd')::NUMERIC,
                (v_installment->>'due_date')::DATE,
                CASE 
                    WHEN (v_installment->>'due_date')::DATE < CURRENT_DATE THEN 'Vencido'
                    WHEN (v_installment->>'due_date')::DATE = CURRENT_DATE THEN 'Vence hoje'
                    ELSE 'A vencer'
                END
            );
        END LOOP;
    END IF;

    -- Lucro Real = Preço de Venda Total - Custo Real dos Aparelhos
    v_total_profit := v_order.total_amount_usd - v_total_cost;

    -- Atualizar Pedido para Finalizado
    UPDATE public.orders
    SET status = 'Finalizado',
        paid_amount_usd = v_total_paid,
        balance_due_usd = GREATEST(0, total_amount_usd - v_total_paid),
        total_profit_usd = v_total_profit,
        finalized_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Log de Auditoria
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data)
    VALUES ('orders', p_order_id, 'RPC_FINALIZE_SALE', jsonb_build_object(
        'total_amount_usd', v_order.total_amount_usd,
        'total_cost_usd', v_total_cost,
        'total_profit_usd', v_total_profit,
        'paid_amount_usd', v_total_paid,
        'balance_due_usd', GREATEST(0, v_order.total_amount_usd - v_total_paid)
    ));

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'total_cost_usd', v_total_cost,
        'total_profit_usd', v_total_profit,
        'balance_due_usd', GREATEST(0, v_order.total_amount_usd - v_total_paid)
    );
END;
$$;

-- 4. Função RPC para Ajuste / Retirada de Estoque sem Venda
CREATE OR REPLACE FUNCTION public.rpc_adjust_device_stock(
    p_device_id UUID,
    p_reason VARCHAR,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev_status VARCHAR;
BEGIN
    SELECT status INTO v_prev_status FROM public.devices WHERE id = p_device_id FOR UPDATE;
    IF v_prev_status IS NULL THEN
        RAISE EXCEPTION 'Aparelho % não encontrado', p_device_id;
    END IF;

    IF v_prev_status = 'Vendido' THEN
        RAISE EXCEPTION 'Não é permitido retirar por ajuste um aparelho já Vendido';
    END IF;

    -- Atualizar status do aparelho
    UPDATE public.devices
    SET status = 'Retirado por ajuste', updated_at = NOW()
    WHERE id = p_device_id;

    -- Inserir registro de ajuste
    INSERT INTO public.stock_adjustments (device_id, reason, notes)
    VALUES (p_device_id, p_reason, p_notes);

    -- Inserir movimentação
    INSERT INTO public.stock_movements (device_id, movement_type, previous_status, new_status, reason, notes)
    VALUES (p_device_id, 'Ajuste', v_prev_status, 'Retirado por ajuste', p_reason, p_notes);

    -- Auditoria
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data)
    VALUES ('devices', p_device_id, 'RPC_ADJUST_STOCK', jsonb_build_object(
        'reason', p_reason,
        'notes', p_notes,
        'previous_status', v_prev_status
    ));

    RETURN jsonb_build_object('success', true, 'device_id', p_device_id);
END;
$$;
