-- ==============================================================================
-- Migration 010: Torna campos de lojistas opcionais no Supabase
-- Apenas 'store_name' permanece como NOT NULL obrigatório.
-- Demais campos (contact_name, phone, whatsapp, document, city, state, address, notes) passam a ser opcionais.
-- ==============================================================================

ALTER TABLE public.retailers ALTER COLUMN contact_name DROP NOT NULL;
ALTER TABLE public.retailers ALTER COLUMN whatsapp DROP NOT NULL;

-- Comentários para documentação do catálogo do banco
COMMENT ON COLUMN public.retailers.store_name IS 'Nome fantasia da loja / Razão social (Único campo obrigatório)';
COMMENT ON COLUMN public.retailers.contact_name IS 'Nome do responsável / contato (Opcional)';
COMMENT ON COLUMN public.retailers.whatsapp IS 'WhatsApp de contato (Opcional)';
