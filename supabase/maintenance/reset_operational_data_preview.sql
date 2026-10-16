-- ==============================================================================
-- RISEMOBILE: PASSO 1 - Conferir o que será apagado (SOMENTE LEITURA, não altera nada)
--
-- Rode no SQL Editor do Supabase antes de reset_operational_data.sql.
-- ==============================================================================

SELECT tabela, linhas, destino FROM (
    SELECT 1 AS ord, 'devices (aparelhos)' AS tabela, count(*) AS linhas, 'APAGA' AS destino FROM public.devices
    UNION ALL SELECT 2, 'stock_entries (entradas de estoque)', count(*), 'APAGA' FROM public.stock_entries
    UNION ALL SELECT 3, 'stock_entry_items', count(*), 'APAGA' FROM public.stock_entry_items
    UNION ALL SELECT 4, 'stock_movements (movimentações)', count(*), 'APAGA' FROM public.stock_movements
    UNION ALL SELECT 5, 'stock_adjustments (ajustes)', count(*), 'APAGA' FROM public.stock_adjustments
    UNION ALL SELECT 6, 'retailers (lojistas)', count(*), 'APAGA' FROM public.retailers
    UNION ALL SELECT 7, 'orders (pedidos/vendas)', count(*), 'APAGA' FROM public.orders
    UNION ALL SELECT 8, 'order_items', count(*), 'APAGA' FROM public.order_items
    UNION ALL SELECT 9, 'order_device_allocations', count(*), 'APAGA' FROM public.order_device_allocations
    UNION ALL SELECT 10, 'payments (pagamentos)', count(*), 'APAGA' FROM public.payments
    UNION ALL SELECT 11, 'installments (parcelas)', count(*), 'APAGA' FROM public.installments
    UNION ALL SELECT 12, 'commissions (comissões)', count(*), 'APAGA' FROM public.commissions
    UNION ALL SELECT 13, 'retailer_referrals (indicações)', count(*), 'APAGA' FROM public.retailer_referrals
    UNION ALL SELECT 14, 'audit_logs (auditoria)', count(*), 'APAGA' FROM public.audit_logs
    UNION ALL SELECT 15, 'sale_returns (devoluções)', CASE WHEN to_regclass('public.sale_returns') IS NULL THEN 0 ELSE (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.sale_returns', false, true, '')))[1]::text::bigint END, 'APAGA'
    UNION ALL SELECT 16, 'sale_return_items', CASE WHEN to_regclass('public.sale_return_items') IS NULL THEN 0 ELSE (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.sale_return_items', false, true, '')))[1]::text::bigint END, 'APAGA'
    UNION ALL SELECT 20, 'grades (catálogo de grades)', count(*), 'MANTÉM' FROM public.grades
    UNION ALL SELECT 21, 'settings (configurações)', count(*), 'MANTÉM' FROM public.settings
    UNION ALL SELECT 22, 'commission_agents (comissionados e seus acessos)', count(*), 'MANTÉM' FROM public.commission_agents
    UNION ALL SELECT 23, 'auth.users (logins, inclusive Risemobile@gmail.com)', count(*), 'MANTÉM' FROM auth.users
) t
ORDER BY ord;

-- O login informado existe e é administrador?
SELECT u.email,
       EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = u.id OR lower(a.email) = lower(u.email)) AS eh_administrador
FROM auth.users u
WHERE lower(u.email) = lower('Risemobile@gmail.com');
