-- ==============================================================================
-- RISEMOBILE: PASSO 2 - Zerar TODOS os dados operacionais (IRREVERSÍVEL)
--
-- O banco não separa dados por usuário: aparelhos, lojistas, vendas etc. pertencem
-- ao projeto inteiro. Zerar "a conta" significa zerar a base inteira.
--
-- APAGA:  aparelhos, entradas de estoque, movimentações, ajustes, lojistas, pedidos,
--         itens/alocações de pedido, pagamentos, parcelas, comissões, indicações,
--         devoluções e auditoria.
-- MANTÉM: logins (auth.users, inclusive Risemobile@gmail.com), app_admins,
--         grades (catálogo), settings (configurações) e commission_agents
--         (comissionados e seus acessos).
--
-- COMO USAR
--   1. Rode reset_operational_data_preview.sql e confira os números.
--   2. Faça um backup (Supabase > Database > Backups) se houver qualquer dado a preservar.
--   3. Troque 'NAO' por 'APAGAR TUDO' logo abaixo e rode este arquivo inteiro.
--      Com 'NAO' ele para com erro e não apaga nada.
-- ==============================================================================

DO $$
DECLARE
    v_confirmacao TEXT := 'NAO';   -- <<< troque para 'APAGAR TUDO' para executar
    v_tabelas TEXT[] := ARRAY[
        'sale_return_items', 'sale_returns', 'stock_adjustments', 'stock_movements',
        'installments', 'payments', 'commissions', 'order_device_allocations',
        'order_items', 'orders', 'retailer_referrals', 'retailers',
        'devices', 'stock_entry_items', 'stock_entries', 'audit_logs'
    ];
    v_existentes TEXT[] := ARRAY[]::TEXT[];
    v_tabela TEXT;
BEGIN
    IF v_confirmacao <> 'APAGAR TUDO' THEN
        RAISE EXCEPTION 'Nada foi apagado. Para confirmar, troque v_confirmacao para ''APAGAR TUDO''.';
    END IF;

    FOREACH v_tabela IN ARRAY v_tabelas LOOP
        IF to_regclass('public.' || v_tabela) IS NOT NULL THEN
            v_existentes := array_append(v_existentes, format('public.%I', v_tabela));
        END IF;
    END LOOP;

    -- Uma única instrução: resolve as chaves estrangeiras entre as tabelas e roda de forma atômica.
    -- Grades, configurações, comissionados e logins não são citados e não são afetados.
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(v_existentes, ', ') || ' RESTART IDENTITY';

    INSERT INTO public.audit_logs (table_name, action, new_data, performed_by)
    VALUES ('*', 'DATA_RESET',
            jsonb_build_object('tabelas_zeradas', to_jsonb(v_existentes), 'motivo', 'Base zerada para iniciar operação com dados reais'),
            'sql-editor');
END $$;

-- Conferência final: tudo deve estar em 0 (audit_logs terá 1 linha, o registro desta limpeza)
SELECT 'devices' AS tabela, count(*) AS linhas FROM public.devices
UNION ALL SELECT 'stock_entries', count(*) FROM public.stock_entries
UNION ALL SELECT 'retailers', count(*) FROM public.retailers
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'payments', count(*) FROM public.payments
UNION ALL SELECT 'installments', count(*) FROM public.installments
UNION ALL SELECT 'commissions', count(*) FROM public.commissions
UNION ALL SELECT 'audit_logs', count(*) FROM public.audit_logs
UNION ALL SELECT 'grades (mantidas)', count(*) FROM public.grades
UNION ALL SELECT 'commission_agents (mantidos)', count(*) FROM public.commission_agents;
