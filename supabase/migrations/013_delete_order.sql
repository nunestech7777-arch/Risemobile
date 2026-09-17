-- ==============================================================================
-- RISEMOBILE: Migration 013 - Exclusão de Venda com Restauração Automática de Estoque
-- Permite excluir uma venda (em qualquer status) diretamente da tela de Vendas.
-- Qualquer aparelho ainda vinculado (Reservado/Separado/Vendido) volta
-- automaticamente para Disponível. Aparelhos já devolvidos permanecem como
-- estão (já estão em Disponível). Remove registros filhos que não possuem
-- ON DELETE CASCADE (sale_returns/sale_return_items/payments) antes de
-- remover o pedido.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_delete_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_alloc RECORD;
    v_restored_count INTEGER := 0;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido % não encontrado', p_order_id;
    END IF;

    FOR v_alloc IN
        SELECT device_id, status FROM public.order_device_allocations WHERE order_id = p_order_id
    LOOP
        IF v_alloc.status != 'Devolvido' THEN
            UPDATE public.devices SET status = 'Disponível', updated_at = NOW() WHERE id = v_alloc.device_id;

            INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason)
            VALUES (v_alloc.device_id, p_order_id, 'Cancelamento de Reserva', v_alloc.status, 'Disponível', 'Venda ' || v_order.order_number || ' excluída pelo administrador');

            v_restored_count := v_restored_count + 1;
        END IF;
    END LOOP;

    -- Filhos sem ON DELETE CASCADE precisam ser removidos explicitamente
    DELETE FROM public.sale_return_items WHERE order_id = p_order_id;
    DELETE FROM public.sale_returns WHERE order_id = p_order_id;
    DELETE FROM public.payments WHERE order_id = p_order_id;

    -- order_items, order_device_allocations, installments e commissions
    -- possuem ON DELETE CASCADE e são removidos automaticamente aqui
    DELETE FROM public.orders WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'restored_devices', v_restored_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_delete_order(UUID) TO authenticated, anon, service_role;
