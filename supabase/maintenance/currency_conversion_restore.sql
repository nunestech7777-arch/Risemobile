-- ==============================================================================
-- RISEMOBILE: PASSO 2 - Restaurar custo/preço de aparelhos EDITADOS na janela
--
-- Rode currency_conversion_audit.sql antes. Este script:
--   * só age sobre os device_id que VOCÊ listar em "aprovados" (vazio = nada muda);
--   * só restaura a partir da auditoria (audit_logs.old_data da 1ª edição na janela),
--     nunca por cálculo com cotação;
--   * guarda backup dos valores atuais em backup.devices_currency_fix (fora da API);
--   * registra cada restauração em audit_logs (RESTORE_CURRENCY_FIX).
-- Aparelhos da seção B (cadastrados na janela) NÃO têm valor original registrado:
-- corrija-os pela tela Estoque > editar, com o valor da nota de compra.
-- ==============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE IF NOT EXISTS backup.devices_currency_fix (
    backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_id UUID NOT NULL,
    imei VARCHAR(50),
    model VARCHAR(100),
    storage VARCHAR(50),
    grade_id UUID,
    cost_price_usd NUMERIC(12, 2),
    suggested_price_usd NUMERIC(12, 2),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- >>> Liste aqui os aparelhos aprovados (device_id da seção A do relatório) <<<
CREATE TEMP TABLE aprovados (device_id UUID PRIMARY KEY) ON COMMIT DROP;
-- INSERT INTO aprovados VALUES
--   ('00000000-0000-0000-0000-000000000000'),
--   ('00000000-0000-0000-0000-000000000000');

-- Valor de antes da PRIMEIRA edição de cada aparelho dentro da janela
CREATE TEMP TABLE origem ON COMMIT DROP AS
SELECT DISTINCT ON (l.record_id) l.record_id AS device_id, l.old_data
FROM public.audit_logs l
JOIN aprovados a ON a.device_id = l.record_id
WHERE l.action = 'UPDATE_DEVICE_DETAILS'
  AND l.created_at >= TIMESTAMPTZ '2026-10-17 16:34:43-03'
  AND (l.new_data ? 'cost_price_usd' OR l.new_data ? 'suggested_price_usd')
ORDER BY l.record_id, l.created_at ASC;

INSERT INTO backup.devices_currency_fix (device_id, imei, model, storage, grade_id, cost_price_usd, suggested_price_usd, created_at, updated_at)
SELECT d.id, d.imei, d.model, d.storage, d.grade_id, d.cost_price_usd, d.suggested_price_usd, d.created_at, d.updated_at
FROM public.devices d JOIN origem o ON o.device_id = d.id;

INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, performed_by)
SELECT 'devices', d.id, 'RESTORE_CURRENCY_FIX',
       jsonb_build_object('cost_price_usd', d.cost_price_usd, 'suggested_price_usd', d.suggested_price_usd),
       jsonb_build_object(
         'cost_price_usd', COALESCE((o.old_data->>'cost_price_usd')::NUMERIC, d.cost_price_usd),
         'suggested_price_usd', COALESCE((o.old_data->>'suggested_price_usd')::NUMERIC, d.suggested_price_usd),
         'fonte', 'audit_logs.old_data (UPDATE_DEVICE_DETAILS)'),
       'manutencao_cambio'
FROM public.devices d JOIN origem o ON o.device_id = d.id;

UPDATE public.devices d
SET cost_price_usd = COALESCE((o.old_data->>'cost_price_usd')::NUMERIC, d.cost_price_usd),
    suggested_price_usd = COALESCE((o.old_data->>'suggested_price_usd')::NUMERIC, d.suggested_price_usd),
    updated_at = NOW()
FROM origem o
WHERE d.id = o.device_id;

COMMIT;

-- Conferência do que foi restaurado agora
SELECT d.imei, d.model, d.storage, b.cost_price_usd AS custo_antes_restauro, d.cost_price_usd AS custo_restaurado,
       b.suggested_price_usd AS preco_antes_restauro, d.suggested_price_usd AS preco_restaurado
FROM backup.devices_currency_fix b
JOIN public.devices d ON d.id = b.device_id
WHERE b.backed_up_at >= NOW() - INTERVAL '5 minutes'
ORDER BY d.model, d.imei;
