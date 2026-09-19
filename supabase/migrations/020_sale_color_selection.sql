-- ==============================================================================
-- RISEMOBILE: Migration 020 - Escolher a COR do aparelho na venda
--
-- Cada item do pedido passa a aceitar uma cor opcional (item.color):
--   * sem cor ("Qualquer cor"): comportamento de sempre (maior saúde de bateria);
--   * com cor: só aparelhos daquela cor são reservados (sem diferenciar maiúsculas);
--     se não houver quantidade suficiente na cor, a reserva inteira é recusada.
--   * itens com cor são atendidos antes dos "qualquer cor" do mesmo pedido.
--   * order_items.color guarda a cor pedida.
--   * a devolução usa o preço da linha do pedido da mesma cor do aparelho.
--
-- Redefine rpc_reserve_devices_for_order e rpc_register_sale_return com CREATE OR REPLACE
-- (as permissões existentes são preservadas). Seguro para rodar mais de uma vez.
-- Rode no SQL Editor do Supabase.
-- ==============================================================================

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS color VARCHAR(50);

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
    v_color VARCHAR;
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

    -- Iterar sobre os itens e alocar aparelhos disponíveis por maior bateria.
    -- Itens com cor escolhida são atendidos ANTES dos "qualquer cor", para que estes
    -- não consumam os aparelhos da cor pedida.
    FOR v_item IN
        SELECT t.value FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(value, ord)
        ORDER BY (NULLIF(btrim(t.value->>'color'), '') IS NULL), t.ord
    LOOP
        v_model := v_item->>'model';
        v_storage := v_item->>'storage';
        v_grade_id := NULL;
        IF (v_item->>'grade_id') IS NOT NULL AND (v_item->>'grade_id') <> '' THEN
            v_grade_id := (v_item->>'grade_id')::UUID;
        END IF;
        v_color := NULLIF(btrim(v_item->>'color'), '');
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 1);
        v_unit_price := COALESCE((v_item->>'unit_price_usd')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida (%) para o item % %', v_qty, v_model, v_storage;
        END IF;

        -- Inserir item do pedido
        INSERT INTO public.order_items (
            order_id, model, storage, grade_id, color, quantity, unit_price_usd, total_price_usd
        ) VALUES (
            v_order_id, v_model, v_storage, v_grade_id, v_color, v_qty, v_unit_price, (v_qty * v_unit_price)
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
              AND (v_color IS NULL OR lower(btrim(color)) = lower(v_color))
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
            RAISE EXCEPTION 'Estoque insuficiente para o modelo % (solicitados: %, disponíveis: %)',
                v_model || ' ' || v_storage || COALESCE(' ' || v_color, ''), v_qty, v_allocated_count;
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

CREATE OR REPLACE FUNCTION public.rpc_register_sale_return(
    p_order_id UUID,
    p_device_ids UUID[],
    p_reason VARCHAR,
    p_notes TEXT,
    p_created_by VARCHAR DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_retailer RECORD;
    v_device_id UUID;
    v_alloc RECORD;
    v_unit_price NUMERIC;
    v_return_id UUID;
    v_total_returned_now NUMERIC := 0;
    v_commission_returned_now NUMERIC := 0;
    v_total_allocated INTEGER;
    v_total_returned_after INTEGER;
    v_new_returned_amount NUMERIC;
    v_new_returned_commission NUMERIC;
    v_net_total NUMERIC;
    v_new_balance_due NUMERIC;
    v_new_credit_due NUMERIC;
    v_new_status VARCHAR;
    v_open_installment RECORD;
    v_open_sum NUMERIC := 0;
    v_excess NUMERIC := 0;
    v_reduction NUMERIC;
BEGIN
    IF p_device_ids IS NULL OR array_length(p_device_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'Selecione ao menos um aparelho para devolução.';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido % não encontrado', p_order_id;
    END IF;

    IF v_order.status NOT IN ('Finalizado', 'Parcialmente Devolvida') THEN
        RAISE EXCEPTION 'Somente vendas Finalizadas ou Parcialmente Devolvidas podem receber devolução (status atual: %)', v_order.status;
    END IF;

    SELECT * INTO v_retailer FROM public.retailers WHERE id = v_order.retailer_id;

    -- Cria o registro de devolução (cabeçalho) primeiro, itens são inseridos no loop
    INSERT INTO public.sale_returns (order_id, retailer_id, reason, notes, created_by)
    VALUES (p_order_id, v_order.retailer_id, p_reason, p_notes, p_created_by)
    RETURNING id INTO v_return_id;

    FOREACH v_device_id IN ARRAY p_device_ids
    LOOP
        SELECT oda.*, d.imei, d.model, d.storage, d.grade_id, d.color INTO v_alloc
        FROM public.order_device_allocations oda
        JOIN public.devices d ON d.id = oda.device_id
        WHERE oda.order_id = p_order_id AND oda.device_id = v_device_id
        FOR UPDATE OF oda;

        IF v_alloc IS NULL THEN
            RAISE EXCEPTION 'Aparelho % não pertence ao pedido %', v_device_id, p_order_id;
        END IF;

        IF v_alloc.status = 'Devolvido' THEN
            RAISE EXCEPTION 'Aparelho % (IMEI %) já foi devolvido anteriormente', v_device_id, v_alloc.imei;
        END IF;

        IF v_alloc.status != 'Vendido' THEN
            RAISE EXCEPTION 'Aparelho % (IMEI %) não está com status Vendido e não pode ser devolvido', v_device_id, v_alloc.imei;
        END IF;

        -- Preço unitário: usa o valor do item do pedido correspondente ao modelo/armazenamento/grade.
        -- Havendo linhas de cores diferentes, prefere a da cor do aparelho, depois a "qualquer cor".
        SELECT oi.unit_price_usd INTO v_unit_price
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id AND oi.model = v_alloc.model AND oi.storage = v_alloc.storage AND oi.grade_id = v_alloc.grade_id
        ORDER BY CASE
                     WHEN oi.color IS NOT NULL AND lower(btrim(oi.color)) = lower(btrim(COALESCE(v_alloc.color, ''))) THEN 0
                     WHEN oi.color IS NULL THEN 1
                     ELSE 2
                 END, oi.id
        LIMIT 1;

        IF v_unit_price IS NULL THEN
            -- Fallback: média simples do pedido caso não encontre item exato
            v_unit_price := CASE WHEN v_order.total_amount_usd > 0 AND (
                SELECT COUNT(*) FROM public.order_device_allocations WHERE order_id = p_order_id
            ) > 0 THEN v_order.total_amount_usd / (SELECT COUNT(*) FROM public.order_device_allocations WHERE order_id = p_order_id) ELSE 0 END;
        END IF;

        INSERT INTO public.sale_return_items (return_id, order_id, device_id, imei, model, storage, original_sale_price_usd)
        VALUES (v_return_id, p_order_id, v_device_id, v_alloc.imei, v_alloc.model, v_alloc.storage, v_unit_price);

        UPDATE public.order_device_allocations
        SET status = 'Devolvido'
        WHERE order_id = p_order_id AND device_id = v_device_id;

        UPDATE public.devices
        SET status = 'Disponível', updated_at = NOW()
        WHERE id = v_device_id;

        INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason, notes)
        VALUES (v_device_id, p_order_id, 'Retorno', 'Vendido', 'Disponível', 'Devolução de Venda (Pedido ' || v_order.order_number || ')', 'Motivo: ' || p_reason || COALESCE(' — ' || p_notes, ''));

        v_total_returned_now := v_total_returned_now + v_unit_price;
        v_commission_returned_now := v_commission_returned_now + COALESCE(v_retailer.commission_per_unit_usd, 0);
    END LOOP;

    UPDATE public.sale_returns
    SET total_amount_usd = v_total_returned_now,
        total_commission_usd = v_commission_returned_now
    WHERE id = v_return_id;

    v_new_returned_amount := v_order.returned_amount_usd + v_total_returned_now;
    v_new_returned_commission := v_order.returned_commission_usd + v_commission_returned_now;
    v_net_total := GREATEST(0, v_order.total_amount_usd - v_new_returned_amount);
    v_new_balance_due := GREATEST(0, v_net_total - v_order.paid_amount_usd);
    v_new_credit_due := GREATEST(0, v_order.paid_amount_usd - v_net_total);

    -- Se o saldo pago excede o novo total líquido, reduz parcelas em aberto
    -- (da mais recente para a mais antiga) para não deixar Contas a Receber incorreto
    v_excess := 0;
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_open_sum FROM public.installments
    WHERE order_id = p_order_id AND status != 'Pago';

    IF v_open_sum > v_new_balance_due THEN
        v_excess := v_open_sum - v_new_balance_due;
        FOR v_open_installment IN
            SELECT * FROM public.installments
            WHERE order_id = p_order_id AND status != 'Pago'
            ORDER BY due_date DESC
        LOOP
            EXIT WHEN v_excess <= 0;
            v_reduction := LEAST(v_excess, v_open_installment.amount_usd);
            IF v_reduction >= v_open_installment.amount_usd THEN
                UPDATE public.installments SET status = 'Pago', amount_usd = 0, notes = COALESCE(notes, '') || ' [Cancelada por devolução]'
                WHERE id = v_open_installment.id;
            ELSE
                UPDATE public.installments SET amount_usd = amount_usd - v_reduction
                WHERE id = v_open_installment.id;
            END IF;
            v_excess := v_excess - v_reduction;
        END LOOP;
    END IF;

    -- Determina se a venda ficou totalmente devolvida
    SELECT COUNT(*) INTO v_total_allocated FROM public.order_device_allocations WHERE order_id = p_order_id;
    SELECT COUNT(*) INTO v_total_returned_after FROM public.order_device_allocations WHERE order_id = p_order_id AND status = 'Devolvido';

    v_new_status := CASE WHEN v_total_returned_after >= v_total_allocated THEN 'Totalmente Devolvida' ELSE 'Parcialmente Devolvida' END;

    UPDATE public.orders
    SET returned_amount_usd = v_new_returned_amount,
        returned_commission_usd = v_new_returned_commission,
        total_profit_usd = total_profit_usd - (v_total_returned_now - (
            SELECT COALESCE(SUM(d.cost_price_usd), 0) FROM public.devices d WHERE d.id = ANY(p_device_ids)
        )),
        balance_due_usd = v_new_balance_due,
        credit_due_usd = v_new_credit_due,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'return_id', v_return_id,
        'order_id', p_order_id,
        'order_status', v_new_status,
        'returned_amount_usd', v_total_returned_now,
        'returned_commission_usd', v_commission_returned_now,
        'net_total_usd', v_net_total,
        'balance_due_usd', v_new_balance_due,
        'credit_due_usd', v_new_credit_due
    );
END;
$$;
