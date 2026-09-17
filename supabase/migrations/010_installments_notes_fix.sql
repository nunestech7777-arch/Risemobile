-- ==============================================================================
-- RISEMOBILE: Migration 010 - Correção da tabela installments p/ Devoluções
-- A rotina de devolução (migration 009) precisa anotar e, quando necessário,
-- zerar uma parcela em aberto que foi absorvida por uma devolução. A tabela
-- installments não tinha coluna "notes" e o CHECK de amount_usd exigia > 0,
-- impedindo esse ajuste. Corrige ambos.
-- ==============================================================================

ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.installments DROP CONSTRAINT IF EXISTS installments_amount_usd_check;
ALTER TABLE public.installments ADD CONSTRAINT installments_amount_usd_check CHECK (amount_usd >= 0);
