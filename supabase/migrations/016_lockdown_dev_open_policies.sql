-- ==============================================================================
-- RISEMOBILE: Migration 016 - Fecha o acesso "aberto de desenvolvimento" do banco
-- (OPCIONAL, mas necessária antes de dar acesso a comissionados de verdade)
--
-- Hoje as tabelas do sistema têm a política "Allow anon full access dev"
-- (USING true): qualquer pessoa com a chave pública (que vai no JavaScript do
-- site) lê e altera tudo — custos, IMEIs, vendas, lojistas. Enquanto isso for
-- assim, esconder dados no portal não protege nada.
--
-- Esta migration troca isso por: somente ADMINISTRADORES (app_admins,
-- criada na migration 015) acessam as tabelas. As funções rpc_* deixam de ser
-- executáveis por usuários anônimos.
--
-- ANTES DE RODAR:
--   1. Rode a 015.
--   2. Confirme que seu usuário está em app_admins:
--        SELECT * FROM public.app_admins;
--      Se não estiver:
--        INSERT INTO public.app_admins (user_id, email)
--        SELECT id, email FROM auth.users WHERE email = 'seu-email@exemplo.com';
--   3. Depois de rodar, entre no sistema e teste vendas/estoque. Se algo
--      quebrar, use o ROLLBACK no final deste arquivo.
--
-- LIMITAÇÃO CONHECIDA: as funções rpc_* são SECURITY DEFINER e continuam
-- executáveis por qualquer usuário LOGADO (inclusive um comissionado que
-- chame a API manualmente). O próximo passo de endurecimento é adicionar
-- "IF NOT public.is_admin() THEN RAISE EXCEPTION" no início de cada rpc_*.
-- Novos administradores precisam ser adicionados em app_admins.
-- ==============================================================================

DO $$
DECLARE
    t TEXT;
    pol RECORD;
BEGIN
    -- Trava de segurança: sem nenhum administrador cadastrado, aborta antes de
    -- mudar qualquer coisa (evita trancar todo mundo para fora).
    IF (SELECT count(*) FROM public.app_admins) = 0 THEN
        RAISE EXCEPTION 'Abortado: app_admins está vazia. Rode a migration 015 e cadastre ao menos um administrador antes.';
    END IF;

    FOREACH t IN ARRAY ARRAY[
        'grades', 'stock_entries', 'stock_entry_items', 'devices', 'retailers',
        'orders', 'order_items', 'order_device_allocations', 'payments',
        'installments', 'commissions', 'stock_movements', 'stock_adjustments',
        'audit_logs', 'settings', 'sale_returns', 'sale_return_items'
    ]
    LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
            LOOP
                EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
            END LOOP;

            EXECUTE format(
                'CREATE POLICY "admins only" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
                t
            );
        END IF;
    END LOOP;
END $$;

-- Funções rpc_*: somente usuários logados (nunca anônimos)
DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname LIKE 'rpc\_%'
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
    END LOOP;
END $$;

-- ==============================================================================
-- ROLLBACK (só use se algo quebrar; devolve o acesso aberto de desenvolvimento):
--
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--     FOREACH t IN ARRAY ARRAY[
--         'grades', 'stock_entries', 'stock_entry_items', 'devices', 'retailers',
--         'orders', 'order_items', 'order_device_allocations', 'payments',
--         'installments', 'commissions', 'stock_movements', 'stock_adjustments',
--         'audit_logs', 'settings', 'sale_returns', 'sale_return_items'
--     ] LOOP
--         IF to_regclass('public.' || t) IS NOT NULL THEN
--             EXECUTE format('DROP POLICY IF EXISTS "admins only" ON public.%I', t);
--             EXECUTE format('CREATE POLICY "Allow anon full access dev" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
--         END IF;
--     END LOOP;
-- END $$;
-- ==============================================================================
