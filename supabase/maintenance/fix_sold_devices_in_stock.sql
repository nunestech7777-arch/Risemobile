-- ==============================================================================
-- RISEMOBILE: PASSO 2 - Tirar do estoque aparelhos que já foram vendidos
--
-- Rode fix_sold_devices_in_stock_preview.sql antes e confira a lista (A).
-- Altera SOMENTE devices.status ('Disponível'/'Reservado' -> 'Vendido') dos
-- aparelhos cuja alocação está 'Vendido' em uma venda concluída. Não apaga
-- nada, não mexe em pedidos, pagamentos, parcelas nem em aparelhos que
-- realmente estão disponíveis. Cada correção gera uma movimentação 'Venda'
-- para o histórico do aparelho. Pode ser executado mais de uma vez.
-- ==============================================================================

BEGIN;

WITH alvo AS (
    SELECT d.id AS device_id, d.status AS previous_status, o.id AS order_id, o.order_number
    FROM public.devices d
    JOIN public.order_device_allocations a ON a.device_id = d.id
    JOIN public.orders o ON o.id = a.order_id
    WHERE d.deleted_at IS NULL
      AND d.status IN ('Disponível', 'Reservado')
      AND a.status = 'Vendido'
      AND o.status IN ('Finalizado', 'Parcialmente Devolvida')
    FOR UPDATE OF d
),
atualizados AS (
    UPDATE public.devices d
    SET status = 'Vendido', updated_at = NOW()
    FROM alvo
    WHERE d.id = alvo.device_id
    RETURNING alvo.device_id, alvo.previous_status, alvo.order_id, alvo.order_number
)
INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason)
SELECT device_id, order_id, 'Venda', previous_status, 'Vendido',
       'Correção de consistência: aparelho da venda ' || order_number || ' ainda constava no estoque'
FROM atualizados;

COMMIT;

-- Conferência: deve retornar 0
SELECT count(*) AS vendidos_ainda_no_estoque
FROM public.devices d
JOIN public.order_device_allocations a ON a.device_id = d.id
JOIN public.orders o ON o.id = a.order_id
WHERE d.deleted_at IS NULL
  AND d.status IN ('Disponível', 'Reservado')
  AND a.status = 'Vendido'
  AND o.status IN ('Finalizado', 'Parcialmente Devolvida');
