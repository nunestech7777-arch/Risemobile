-- ==============================================================================
-- RISEMOBILE: Migration 012 - Idempotência da Finalização cobre Devoluções
-- A migration 008 bloqueava re-finalizar um pedido 'Finalizado' ou 'Cancelado',
-- mas não conhecia os status 'Parcialmente Devolvida' / 'Totalmente Devolvida'
-- criados na migration 009. Isso permitia finalizar de novo um pedido que já
-- teve devolução registrada, sobrescrevendo o status de volta para
-- 'Finalizado' e apagando o rastro da devolução (embora returned_amount_usd
-- permanecesse, o que deixava o pedido em um estado inconsistente).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_finalize_order_sale(
    p_order_id UUID,
    p_payments JSONB,
    p_installments JSONB
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
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido % não encontrado', p_order_id;
    END IF;

    IF v_order.status IN ('Finalizado', 'Parcialmente Devolvida', 'Totalmente Devolvida') THEN
        RAISE EXCEPTION 'Pedido % já foi finalizado anteriormente', v_order.order_number;
    END IF;

    IF v_order.status = 'Cancelado' THEN
        RAISE EXCEPTION 'Pedido % está cancelado e não pode ser finalizado', v_order.order_number;
    END IF;

    FOR v_alloc IN
        SELECT oda.device_id, d.cost_price_usd
        FROM public.order_device_allocations oda
        JOIN public.devices d ON d.id = oda.device_id
        WHERE oda.order_id = p_order_id
    LOOP
        v_total_cost := v_total_cost + v_alloc.cost_price_usd;

        UPDATE public.devices
        SET status = 'Vendido', updated_at = NOW()
        WHERE id = v_alloc.device_id;

        UPDATE public.order_device_allocations
        SET status = 'Vendido'
        WHERE order_id = p_order_id AND device_id = v_alloc.device_id;

        INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason)
        VALUES (v_alloc.device_id, p_order_id, 'Venda', 'Reservado', 'Vendido', 'Venda finalizada no pedido ' || v_order.order_number);
    END LOOP;

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

    v_total_profit := v_order.total_amount_usd - v_total_cost;

    UPDATE public.orders
    SET status = 'Finalizado',
        paid_amount_usd = v_total_paid,
        balance_due_usd = GREATEST(0, total_amount_usd - v_total_paid),
        total_profit_usd = v_total_profit,
        finalized_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'total_cost_usd', v_total_cost,
        'total_profit_usd', v_total_profit,
        'balance_due_usd', GREATEST(0, v_order.total_amount_usd - v_total_paid)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_finalize_order_sale(UUID, JSONB, JSONB) TO authenticated, anon, service_role;
