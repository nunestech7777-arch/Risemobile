-- ==============================================================================
-- RISEMOBILE: Migration 015 - Endurecimento de segurança do Portal do Comissionado
-- Aplica por cima da migration 014 (já executada). Corrige:
--   1. Qualquer usuário logado tinha acesso total a commission_agents e
--      retailer_referrals (inclusive à coluna de senha).
--   2. Não existia o conceito de "administrador": qualquer conta do Supabase Auth
--      era tratada como admin. Agora existe uma lista explícita (app_admins).
--   3. A função do portal aceitava um p_agent_id arbitrário sem login, usava a
--      coluna inexistente orders.returned_quantity e ignorava vendas parcialmente
--      devolvidas. Agora identifica o comissionado SOMENTE pelo login (JWT) e
--      calcula as peças com base nas alocações ativas (igual à tela de Comissões).
--   4. Senhas em texto puro (password_hash): a coluna é removida. A senha do
--      comissionado passa a ser gerenciada exclusivamente pelo Supabase Auth.
-- ==============================================================================

-- 1. Lista explícita de administradores ---------------------------------------
CREATE TABLE IF NOT EXISTS public.app_admins (
    user_id UUID PRIMARY KEY,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS ligado e SEM políticas: ninguém lê/escreve via API. Só as funções abaixo
-- (SECURITY DEFINER) e o service_role enxergam esta tabela.
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access dev" ON public.app_admins;

-- Contas que JÁ existem hoje (e não são comissionados) passam a ser administradores.
INSERT INTO public.app_admins (user_id, email)
SELECT u.id, u.email
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.commission_agents a
    WHERE a.user_id = u.id OR lower(a.email) = lower(u.email)
)
ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
    IF (SELECT count(*) FROM public.app_admins) = 0 THEN
        RAISE WARNING 'Nenhum administrador foi cadastrado em app_admins. Adicione um: INSERT INTO public.app_admins (user_id, email) SELECT id, email FROM auth.users WHERE email = ''seu-email@exemplo.com'';';
    END IF;
END $$;

-- 2. Funções de identidade -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.current_commission_agent_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT a.id
    FROM public.commission_agents a
    WHERE auth.uid() IS NOT NULL
      AND (a.user_id = auth.uid() OR lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    LIMIT 1;
$$;

-- Papel do usuário logado: 'admin' | 'commission_agent' | 'inactive_agent' | 'none'
CREATE OR REPLACE FUNCTION public.get_my_access()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agent RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('role', 'none');
    END IF;

    IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
        RETURN jsonb_build_object('role', 'admin');
    END IF;

    SELECT * INTO v_agent
    FROM public.commission_agents a
    WHERE a.user_id = auth.uid()
       OR lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    LIMIT 1;

    IF FOUND THEN
        IF v_agent.is_active THEN
            RETURN jsonb_build_object('role', 'commission_agent', 'agent_id', v_agent.id, 'name', v_agent.name, 'phone', coalesce(v_agent.phone, ''));
        END IF;
        RETURN jsonb_build_object('role', 'inactive_agent');
    END IF;

    RETURN jsonb_build_object('role', 'none');
END;
$$;

-- 3. Políticas das tabelas de comissionados ------------------------------------
ALTER TABLE public.commission_agents DROP COLUMN IF EXISTS password_hash;

DROP POLICY IF EXISTS "Admin full access to commission_agents" ON public.commission_agents;
DROP POLICY IF EXISTS "Commission agent view own profile" ON public.commission_agents;
DROP POLICY IF EXISTS "Allow anon full access dev" ON public.commission_agents;
DROP POLICY IF EXISTS "Admin full access to retailer_referrals" ON public.retailer_referrals;
DROP POLICY IF EXISTS "Allow anon full access dev" ON public.retailer_referrals;
DROP POLICY IF EXISTS "admins manage commission_agents" ON public.commission_agents;
DROP POLICY IF EXISTS "agent reads own row" ON public.commission_agents;
DROP POLICY IF EXISTS "admins manage retailer_referrals" ON public.retailer_referrals;
DROP POLICY IF EXISTS "agent reads own referrals" ON public.retailer_referrals;

CREATE POLICY "admins manage commission_agents" ON public.commission_agents
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "agent reads own row" ON public.commission_agents
    FOR SELECT TO authenticated
    USING (id = public.current_commission_agent_id());

CREATE POLICY "admins manage retailer_referrals" ON public.retailer_referrals
    FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "agent reads own referrals" ON public.retailer_referrals
    FOR SELECT TO authenticated
    USING (agent_id = public.current_commission_agent_id());

-- 4. Função do portal (somente leitura, identifica o comissionado pelo login) --
DROP FUNCTION IF EXISTS public.get_commission_agent_portal_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_commission_agent_portal_data(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agent RECORD;
    v_referrals JSONB;
    v_history JSONB;
    v_total_units NUMERIC := 0;
    v_total_comm NUMERIC := 0;
    v_active INTEGER := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: faça login.';
    END IF;

    SELECT * INTO v_agent
    FROM public.commission_agents a
    WHERE a.user_id = auth.uid()
       OR lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Acesso não autorizado: Comissionado não identificado.';
    END IF;

    IF NOT v_agent.is_active THEN
        RAISE EXCEPTION 'Acesso desativado. Entre em contato com a administração da RiseMobile.';
    END IF;

    -- Resumo por loja indicada. Peças válidas = aparelhos ainda ativos na venda
    -- (devolvidos não contam), exatamente como na tela de Comissões do admin.
    WITH valid_orders AS (
        SELECT o.id AS order_id, o.retailer_id,
               (SELECT count(*) FROM public.order_device_allocations oda
                 WHERE oda.order_id = o.id AND oda.status <> 'Devolvido') AS units
        FROM public.orders o
        WHERE o.status IN ('Finalizado', 'Parcialmente Devolvida')
          AND o.retailer_id IN (SELECT r.retailer_id FROM public.retailer_referrals r WHERE r.agent_id = v_agent.id)
          AND (p_start_date IS NULL OR coalesce(o.finalized_at, o.created_at) >= p_start_date)
          AND (p_end_date IS NULL OR coalesce(o.finalized_at, o.created_at) <= p_end_date)
    ),
    per_ref AS (
        SELECT ref.id, ref.retailer_id, ret.store_name, ret.city, ret.state,
               ref.commission_per_unit_usd, ref.status, ref.notes, ref.created_at,
               coalesce((SELECT sum(vo.units) FROM valid_orders vo WHERE vo.retailer_id = ref.retailer_id), 0) AS units
        FROM public.retailer_referrals ref
        JOIN public.retailers ret ON ret.id = ref.retailer_id
        WHERE ref.agent_id = v_agent.id
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', pr.id,
               'retailer_id', pr.retailer_id,
               'retailer_name', pr.store_name,
               'retailer_city', coalesce(pr.city, ''),
               'retailer_state', coalesce(pr.state, ''),
               'commission_per_unit_usd', pr.commission_per_unit_usd,
               'units_count', pr.units,
               'accumulated_commission_usd', pr.units * pr.commission_per_unit_usd,
               'status', pr.status,
               'notes', coalesce(pr.notes, ''),
               'created_at', pr.created_at
           ) ORDER BY pr.created_at DESC), '[]'::jsonb),
           coalesce(sum(pr.units), 0),
           coalesce(sum(pr.units * pr.commission_per_unit_usd), 0),
           (count(*) FILTER (WHERE pr.status = 'Ativo'))::INTEGER
    INTO v_referrals, v_total_units, v_total_comm, v_active
    FROM per_ref pr;

    -- Extrato por venda (somente campos seguros: sem custos, margens ou IMEIs)
    WITH valid_orders AS (
        SELECT o.id AS order_id, o.order_number, o.status, o.retailer_id,
               coalesce(o.finalized_at, o.created_at) AS order_date,
               (SELECT count(*) FROM public.order_device_allocations oda
                 WHERE oda.order_id = o.id AND oda.status <> 'Devolvido') AS units
        FROM public.orders o
        WHERE o.status IN ('Finalizado', 'Parcialmente Devolvida')
          AND o.retailer_id IN (SELECT r.retailer_id FROM public.retailer_referrals r WHERE r.agent_id = v_agent.id)
          AND (p_start_date IS NULL OR coalesce(o.finalized_at, o.created_at) >= p_start_date)
          AND (p_end_date IS NULL OR coalesce(o.finalized_at, o.created_at) <= p_end_date)
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'order_id', vo.order_id,
               'order_number', vo.order_number,
               'retailer_name', ret.store_name,
               'store_name', ret.store_name,
               'date', vo.order_date,
               'units_count', vo.units,
               'commission_rate_usd', rate.commission_per_unit_usd,
               'commission_usd', vo.units * rate.commission_per_unit_usd,
               'commission_earned', vo.units * rate.commission_per_unit_usd,
               'status', vo.status
           ) ORDER BY vo.order_date DESC), '[]'::jsonb)
    INTO v_history
    FROM valid_orders vo
    JOIN public.retailers ret ON ret.id = vo.retailer_id
    JOIN LATERAL (
        SELECT r2.commission_per_unit_usd
        FROM public.retailer_referrals r2
        WHERE r2.agent_id = v_agent.id AND r2.retailer_id = vo.retailer_id
        ORDER BY r2.created_at
        LIMIT 1
    ) rate ON true
    WHERE vo.units > 0;

    RETURN jsonb_build_object(
        'agent', jsonb_build_object(
            'id', v_agent.id,
            'name', v_agent.name,
            'email', v_agent.email,
            'phone', coalesce(v_agent.phone, ''),
            'is_active', v_agent.is_active
        ),
        'referrals', v_referrals,
        'orders_history', v_history,
        'salesHistory', v_history,
        'total_units', v_total_units,
        'total_commission_usd', v_total_comm,
        'active_retailers_count', v_active,
        'summary', jsonb_build_object(
            'totalUnits', v_total_units,
            'totalCommissionUSD', v_total_comm,
            'activeStores', v_active
        )
    );
END;
$$;

-- 5. Permissões de execução: somente usuários logados (nunca anônimos) ---------
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_commission_agent_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_commission_agent_portal_data(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_commission_agent_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_commission_agent_portal_data(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
