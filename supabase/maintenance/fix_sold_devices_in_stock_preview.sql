-- ==============================================================================
-- RISEMOBILE: PASSO 1 - Conferir aparelhos vendidos que ainda contam como estoque
-- (SOMENTE LEITURA, não altera nada)
--
-- Rode no SQL Editor do Supabase antes de fix_sold_devices_in_stock.sql.
-- Vínculo validado pela alocação do aparelho (device_id é único em
-- order_device_allocations) + IMEI exibido para conferência.
-- ==============================================================================

-- A) SERÃO CORRIGIDOS: venda concluída válida, mas o aparelho ainda está
--    Disponível/Reservado. O passo 2 muda apenas devices.status para 'Vendido'.
SELECT d.imei, d.model, d.storage, d.status AS status_atual,
       o.order_number, o.status AS status_venda, a.status AS status_alocacao,
       o.finalized_at
FROM public.devices d
JOIN public.order_device_allocations a ON a.device_id = d.id
JOIN public.orders o ON o.id = a.order_id
WHERE d.deleted_at IS NULL
  AND d.status IN ('Disponível', 'Reservado')
  AND a.status = 'Vendido'
  AND o.status IN ('Finalizado', 'Parcialmente Devolvida')
ORDER BY d.model, d.storage, d.imei;

-- B) SOMENTE RELATÓRIO (não são alterados): aparelhos 'Vendido' sem nenhuma
--    venda vinculada (ex.: venda apagada antes da migration 013). Exigem
--    conferência física antes de qualquer ajuste manual.
SELECT d.imei, d.model, d.storage, d.status, d.updated_at
FROM public.devices d
LEFT JOIN public.order_device_allocations a ON a.device_id = d.id
WHERE d.deleted_at IS NULL
  AND d.status = 'Vendido'
  AND a.id IS NULL
ORDER BY d.model, d.storage, d.imei;

-- C) SOMENTE RELATÓRIO: IMEIs duplicados entre aparelhos ativos.
SELECT d.imei, count(*) AS cadastros, array_agg(d.status ORDER BY d.created_at) AS status
FROM public.devices d
WHERE d.deleted_at IS NULL
  AND NULLIF(trim(d.imei), '') IS NOT NULL
GROUP BY d.imei
HAVING count(*) > 1
ORDER BY d.imei;
