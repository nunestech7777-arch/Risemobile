-- ==============================================================================
-- RISEMOBILE: PASSO 1 - Auditoria da conversão USD -> BRL (SOMENTE LEITURA)
--
-- O que aconteceu: entre o commit ab60ad1 (17/10/2026 16:34, horário de Brasília)
-- e a correção seguinte, a interface MULTIPLICAVA os valores pela cotação ao
-- exibir (nada gravado) e DIVIDIA pela cotação o que era digitado nos campos
-- de valor ao salvar (isso sim gravado). Registros antigos não foram tocados.
--
-- Este relatório lista somente o que foi GRAVADO nessa janela. Nada é alterado.
-- Se você publicou a versão depois das 16:34, os itens anteriores à publicação
-- também aparecem aqui, mas estão corretos (confira a data/hora de cada um).
-- ==============================================================================

-- 0) Resumo geral
WITH janela AS (SELECT TIMESTAMPTZ '2026-10-17 16:34:43-03' AS inicio)
SELECT 'Aparelhos ativos (total)' AS item, count(*) AS qtd FROM public.devices WHERE deleted_at IS NULL
UNION ALL
SELECT 'Aparelhos cadastrados ANTES da janela (valores intactos)', count(*)
FROM public.devices, janela WHERE deleted_at IS NULL AND created_at < janela.inicio
  AND NOT EXISTS (
    SELECT 1 FROM public.audit_logs l
    WHERE l.record_id = devices.id AND l.action = 'UPDATE_DEVICE_DETAILS' AND l.created_at >= janela.inicio
      AND (l.new_data ? 'cost_price_usd' OR l.new_data ? 'suggested_price_usd'))
UNION ALL
SELECT 'Aparelhos com custo/preço EDITADO na janela (seção A)', count(DISTINCT l.record_id)
FROM public.audit_logs l, janela
WHERE l.action = 'UPDATE_DEVICE_DETAILS' AND l.created_at >= janela.inicio
  AND (l.new_data->>'cost_price_usd' IS DISTINCT FROM l.old_data->>'cost_price_usd'
    OR l.new_data->>'suggested_price_usd' IS DISTINCT FROM l.old_data->>'suggested_price_usd')
UNION ALL
SELECT 'Aparelhos CADASTRADOS na janela (seção B)', count(*) FROM public.devices, janela
WHERE deleted_at IS NULL AND created_at >= janela.inicio
UNION ALL
SELECT 'Vendas CRIADAS na janela (seção C)', count(*) FROM public.orders, janela WHERE created_at >= janela.inicio
UNION ALL
SELECT 'Pagamentos REGISTRADOS na janela (seção D)', count(*) FROM public.payments, janela WHERE created_at >= janela.inicio;

-- A) Edições de custo/preço na janela. Fonte de recuperação: audit_logs.old_data
--    (valor exato antes da edição). Se você editou para MUDAR o preço, o valor
--    pretendido não é o antigo: decida aparelho por aparelho antes do passo 2.
WITH janela AS (SELECT TIMESTAMPTZ '2026-10-17 16:34:43-03' AS inicio)
SELECT d.id AS device_id, d.imei, d.model, d.storage, g.name AS grade,
       (l.created_at AT TIME ZONE 'America/Sao_Paulo') AS editado_em_sp,
       l.old_data->>'cost_price_usd'      AS custo_antes_fonte_auditoria,
       l.new_data->>'cost_price_usd'      AS custo_gravado_convertido,
       d.cost_price_usd                   AS custo_atual,
       l.old_data->>'suggested_price_usd' AS preco_antes_fonte_auditoria,
       l.new_data->>'suggested_price_usd' AS preco_gravado_convertido,
       d.suggested_price_usd              AS preco_atual,
       l.performed_by
FROM public.audit_logs l
JOIN public.devices d ON d.id = l.record_id
LEFT JOIN public.grades g ON g.id = d.grade_id
CROSS JOIN janela
WHERE l.action = 'UPDATE_DEVICE_DETAILS' AND l.created_at >= janela.inicio
  AND (l.new_data->>'cost_price_usd' IS DISTINCT FROM l.old_data->>'cost_price_usd'
    OR l.new_data->>'suggested_price_usd' IS DISTINCT FROM l.old_data->>'suggested_price_usd')
ORDER BY l.created_at;

-- B) Aparelhos cadastrados na janela: o valor gravado é (digitado ÷ cotação daquele
--    momento). Não há registro do valor digitado: REVISÃO MANUAL (confira a nota de compra).
WITH janela AS (SELECT TIMESTAMPTZ '2026-10-17 16:34:43-03' AS inicio)
SELECT d.id AS device_id, d.imei, d.model, d.storage, g.name AS grade,
       (d.created_at AT TIME ZONE 'America/Sao_Paulo') AS cadastrado_em_sp,
       d.cost_price_usd AS custo_gravado, d.suggested_price_usd AS preco_gravado,
       'REVISAR: valor original não registrado' AS situacao
FROM public.devices d
LEFT JOIN public.grades g ON g.id = d.grade_id
CROSS JOIN janela
WHERE d.deleted_at IS NULL AND d.created_at >= janela.inicio
ORDER BY d.created_at;

-- C) Vendas criadas na janela (preço unitário digitado em R$ foi gravado ÷ cotação)
WITH janela AS (SELECT TIMESTAMPTZ '2026-10-17 16:34:43-03' AS inicio)
SELECT o.order_number, o.status, (o.created_at AT TIME ZONE 'America/Sao_Paulo') AS criada_em_sp,
       i.model, i.storage, i.quantity, i.unit_price_usd AS preco_unitario_gravado,
       o.total_amount_usd AS total_gravado, 'REVISAR' AS situacao
FROM public.orders o
JOIN public.order_items i ON i.order_id = o.id
CROSS JOIN janela
WHERE o.created_at >= janela.inicio
ORDER BY o.created_at;

-- D) Pagamentos registrados na janela (valor digitado em R$ foi gravado ÷ cotação)
WITH janela AS (SELECT TIMESTAMPTZ '2026-10-17 16:34:43-03' AS inicio)
SELECT o.order_number, p.payment_method, (p.created_at AT TIME ZONE 'America/Sao_Paulo') AS registrado_em_sp,
       p.amount_usd AS valor_gravado, p.exchange_rate, 'REVISAR' AS situacao
FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
CROSS JOIN janela
WHERE p.created_at >= janela.inicio
ORDER BY p.created_at;
