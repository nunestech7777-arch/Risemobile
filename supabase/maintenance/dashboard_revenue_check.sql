-- ==============================================================================
-- RISEMOBILE: Conferir o card "Faturamento & Vendas" do Dashboard (SOMENTE LEITURA)
--
-- Mesma regra do app (src/lib/salesPeriod.js):
--   venda válida  = orders.status IN ('Finalizado','Parcialmente Devolvida','Totalmente Devolvida')
--   data da venda = orders.finalized_at, no fuso America/Sao_Paulo
--   faturamento   = total_amount_usd - returned_amount_usd   (US$)
--   lucro         = total_profit_usd                          (US$)
--   7D/30D/1A     = desde a meia-noite (SP) de 6/29/364 dias atrás; 24H = últimas 24 horas
-- ==============================================================================

-- 1) Totais por período (compare com o card em cada filtro)
WITH vendas AS (
    SELECT o.*,
           COALESCE(o.total_amount_usd, 0) - COALESCE(o.returned_amount_usd, 0) AS faturamento,
           COALESCE(o.total_profit_usd, 0) AS lucro
    FROM public.orders o
    WHERE o.status IN ('Finalizado', 'Parcialmente Devolvida', 'Totalmente Devolvida')
),
hoje_sp AS (
    SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d
)
SELECT periodo, count(*) AS vendas, COALESCE(sum(faturamento), 0) AS faturamento_usd, COALESCE(sum(lucro), 0) AS lucro_usd
FROM (
    SELECT '24H' AS periodo, 1 AS ord, v.* FROM vendas v WHERE v.finalized_at >= now() - interval '24 hours'
    UNION ALL
    SELECT '7D', 2, v.* FROM vendas v, hoje_sp
    WHERE v.finalized_at >= ((hoje_sp.d - 6)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    UNION ALL
    SELECT '30D', 3, v.* FROM vendas v, hoje_sp
    WHERE v.finalized_at >= ((hoje_sp.d - 29)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    UNION ALL
    SELECT '1A', 4, v.* FROM vendas v, hoje_sp
    WHERE v.finalized_at >= ((hoje_sp.d - 364)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    UNION ALL
    SELECT 'Tudo', 5, v.* FROM vendas v
) t
GROUP BY periodo, ord
ORDER BY ord;

-- 2) Vendas que compõem o total, da mais recente para a mais antiga (origem de cada valor)
SELECT o.order_number,
       r.store_name AS lojista,
       o.status,
       (o.finalized_at AT TIME ZONE 'America/Sao_Paulo') AS concluida_em_sp,
       (o.created_at AT TIME ZONE 'America/Sao_Paulo') AS criada_em_sp,
       COALESCE(o.total_amount_usd, 0) - COALESCE(o.returned_amount_usd, 0) AS faturamento_usd,
       o.total_profit_usd AS lucro_usd,
       o.notes
FROM public.orders o
LEFT JOIN public.retailers r ON r.id = o.retailer_id
WHERE o.status IN ('Finalizado', 'Parcialmente Devolvida', 'Totalmente Devolvida')
ORDER BY o.finalized_at DESC NULLS LAST;

-- 3) Vendas concluídas SEM finalized_at (entram só em "Tudo"; confira a origem)
SELECT o.order_number, o.status, o.created_at, o.updated_at, o.total_amount_usd
FROM public.orders o
WHERE o.status IN ('Finalizado', 'Parcialmente Devolvida', 'Totalmente Devolvida')
  AND o.finalized_at IS NULL
ORDER BY o.created_at;
