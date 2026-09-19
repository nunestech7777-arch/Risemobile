-- ==============================================================================
-- RISEMOBILE: Migration 019 - Zerar a base de dados operacional (IRREVERSÍVEL)
--
-- Função chamada pelo botão "Zerar Base de Dados". A regra vive no banco:
--   * só administrador (is_admin(), migration 015). Se a 015 não estiver aplicada a
--     função RECUSA (falha fechada), porque ela apagaria tudo para qualquer logado;
--   * exige a confirmação digitada 'APAGAR TUDO';
--   * anônimo não executa (padrão da migration 016).
--
-- APAGA:  aparelhos, entradas de estoque, movimentações, ajustes, lojistas, pedidos,
--         itens/alocações de pedido, pagamentos, parcelas, comissões, indicações,
--         devoluções e auditoria (fica um único registro DATA_RESET).
-- MANTÉM: logins (auth.users), app_admins, grades, settings e commission_agents.
--
-- Seguro para rodar mais de uma vez. Rode no SQL Editor do Supabase.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_reset_operational_data(p_confirmation TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claims JSONB;
    v_role TEXT;
    v_email TEXT;
    v_is_admin BOOLEAN := FALSE;
    v_tables TEXT[] := ARRAY[
        'sale_return_items', 'sale_returns', 'stock_adjustments', 'stock_movements',
        'installments', 'payments', 'commissions', 'order_device_allocations',
        'order_items', 'orders', 'retailer_referrals', 'retailers',
        'devices', 'stock_entry_items', 'stock_entries', 'audit_logs'
    ];
    v_existing TEXT[] := ARRAY[]::TEXT[];
    v_table TEXT;
    v_count BIGINT;
    v_counts JSONB := '{}'::JSONB;
    v_actor VARCHAR;
BEGIN
    v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
    v_role := v_claims ->> 'role';
    v_email := v_claims ->> 'email';

    IF COALESCE(v_role, '') <> 'service_role' THEN
        IF to_regprocedure('public.is_admin()') IS NULL THEN
            RAISE EXCEPTION 'Zerar a base está bloqueado: o controle de administradores (migration 015) não está instalado.';
        END IF;
        EXECUTE 'SELECT public.is_admin()' INTO v_is_admin;
        IF NOT COALESCE(v_is_admin, FALSE) THEN
            RAISE EXCEPTION 'Apenas administradores podem zerar a base de dados.';
        END IF;
    END IF;

    IF btrim(COALESCE(p_confirmation, '')) <> 'APAGAR TUDO' THEN
        RAISE EXCEPTION 'Confirmação inválida. Digite APAGAR TUDO para zerar a base de dados.';
    END IF;

    FOREACH v_table IN ARRAY v_tables LOOP
        IF to_regclass('public.' || v_table) IS NOT NULL THEN
            EXECUTE format('SELECT count(*) FROM public.%I', v_table) INTO v_count;
            v_counts := v_counts || jsonb_build_object(v_table, v_count);
            v_existing := array_append(v_existing, format('public.%I', v_table));
        END IF;
    END LOOP;

    -- Uma única instrução: resolve as chaves estrangeiras entre as tabelas e é atômica.
    -- Grades, configurações, comissionados e logins não são citados e não são afetados.
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(v_existing, ', ') || ' RESTART IDENTITY';

    v_actor := COALESCE(NULLIF(v_email, ''), 'admin');

    INSERT INTO public.audit_logs (table_name, action, old_data, new_data, performed_by)
    VALUES ('*', 'DATA_RESET', v_counts,
            jsonb_build_object('tabelas_zeradas', to_jsonb(v_existing), 'motivo', 'Base zerada pelo administrador'),
            v_actor);

    RETURN jsonb_build_object('success', true, 'deleted_counts', v_counts, 'performed_by', v_actor);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reset_operational_data(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reset_operational_data(TEXT) TO authenticated, service_role;
