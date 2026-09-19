-- ==============================================================================
-- RISEMOBILE: Migration 014 - Commission Agents and Portal Security
-- Criação da estrutura de usuários comissionados, vínculos e RPC segura
-- ==============================================================================

-- 1. Tabela de Comissionados / Indicadores
CREATE TABLE IF NOT EXISTS public.commission_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE, -- Opcionalmente vinculado a auth.users(id)
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash TEXT, -- Fallback hash para autenticação customizada quando aplicável
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_agents_email ON public.commission_agents (email);
CREATE INDEX IF NOT EXISTS idx_commission_agents_name ON public.commission_agents (name);

-- 2. Tabela de Indicações de Lojistas
CREATE TABLE IF NOT EXISTS public.retailer_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES public.commission_agents(id) ON DELETE SET NULL,
    referrer_name VARCHAR(150) NOT NULL,
    retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
    commission_per_unit_usd NUMERIC(10, 2) NOT NULL DEFAULT 1.00 CHECK (commission_per_unit_usd >= 0),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retailer_referrals_agent_id ON public.retailer_referrals (agent_id);
CREATE INDEX IF NOT EXISTS idx_retailer_referrals_retailer_id ON public.retailer_referrals (retailer_id);
CREATE INDEX IF NOT EXISTS idx_retailer_referrals_referrer_name ON public.retailer_referrals (referrer_name);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.commission_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_referrals ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para Administradores
CREATE POLICY "Admin full access to commission_agents" ON public.commission_agents
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() ->> 'role') = 'admin' OR
        auth.role() = 'authenticated'
    )
    WITH CHECK (
        auth.role() = 'service_role' OR 
        coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() ->> 'role') = 'admin' OR
        auth.role() = 'authenticated'
    );

CREATE POLICY "Admin full access to retailer_referrals" ON public.retailer_referrals
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() ->> 'role') = 'admin' OR
        auth.role() = 'authenticated'
    )
    WITH CHECK (
        auth.role() = 'service_role' OR 
        coalesce(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() ->> 'role') = 'admin' OR
        auth.role() = 'authenticated'
    );

-- 5. Política de Leitura Restrita para o Próprio Comissionado
CREATE POLICY "Commission agent view own profile" ON public.commission_agents
    FOR SELECT USING (
        auth.uid() = user_id OR 
        email = auth.jwt() ->> 'email'
    );

-- 6. RPC Segura para o Portal do Comissionado (Somente Leitura Agregada)
CREATE OR REPLACE FUNCTION public.get_commission_agent_portal_data(
    p_agent_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_agent_id UUID;
    v_agent_record RECORD;
    v_result JSON;
BEGIN
    -- Se executado por um usuário autenticado comum, identifica o agent pelo auth.uid() ou e-mail do token
    IF auth.role() = 'authenticated' THEN
        SELECT id INTO v_target_agent_id 
        FROM public.commission_agents 
        WHERE user_id = auth.uid() OR email = (auth.jwt() ->> 'email')
        LIMIT 1;
    ELSE
        v_target_agent_id := p_agent_id;
    END IF;

    IF v_target_agent_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: Comissionado não identificado.';
    END IF;

    -- Obter dados do comissionado
    SELECT * INTO v_agent_record FROM public.commission_agents WHERE id = v_target_agent_id;
    IF NOT FOUND OR NOT v_agent_record.is_active THEN
        RAISE EXCEPTION 'Acesso desativado ou não encontrado.';
    END IF;

    -- Monta payload seguro (sem custos, sem IMEIs, sem dados confidenciais)
    SELECT json_build_object(
        'agent', json_build_object(
            'id', v_agent_record.id,
            'name', v_agent_record.name,
            'email', v_agent_record.email,
            'phone', v_agent_record.phone,
            'is_active', v_agent_record.is_active
        ),
        'referrals', (
            SELECT coalesce(json_agg(json_build_object(
                'id', ref.id,
                'retailer_id', ref.retailer_id,
                'retailer_name', ret.store_name,
                'commission_per_unit_usd', ref.commission_per_unit_usd,
                'status', ref.status,
                'created_at', ref.created_at,
                'units_count', (
                    SELECT coalesce(sum(
                        (SELECT coalesce(sum(oi.quantity), 0) FROM public.order_items oi WHERE oi.order_id = o.id)
                        - coalesce(o.returned_quantity, 0)
                    ), 0)
                    FROM public.orders o
                    WHERE o.retailer_id = ref.retailer_id
                      AND o.status = 'Finalizado'
                      AND (p_start_date IS NULL OR o.created_at >= p_start_date)
                      AND (p_end_date IS NULL OR o.created_at <= p_end_date)
                ),
                'accumulated_commission_usd', (
                    SELECT coalesce(sum(
                        ((SELECT coalesce(sum(oi.quantity), 0) FROM public.order_items oi WHERE oi.order_id = o.id)
                        - coalesce(o.returned_quantity, 0)) * ref.commission_per_unit_usd
                    ), 0)
                    FROM public.orders o
                    WHERE o.retailer_id = ref.retailer_id
                      AND o.status = 'Finalizado'
                      AND (p_start_date IS NULL OR o.created_at >= p_start_date)
                      AND (p_end_date IS NULL OR o.created_at <= p_end_date)
                )
            )), '[]'::json)
            FROM public.retailer_referrals ref
            JOIN public.retailers ret ON ret.id = ref.retailer_id
            WHERE (ref.agent_id = v_target_agent_id OR ref.referrer_name ILIKE v_agent_record.name)
        ),
        'orders_history', (
            SELECT coalesce(json_agg(json_build_object(
                'order_id', o.id,
                'order_number', o.order_number,
                'retailer_name', ret.store_name,
                'date', o.created_at,
                'units_count', (
                    (SELECT coalesce(sum(oi.quantity), 0) FROM public.order_items oi WHERE oi.order_id = o.id)
                    - coalesce(o.returned_quantity, 0)
                ),
                'commission_usd', (
                    ((SELECT coalesce(sum(oi.quantity), 0) FROM public.order_items oi WHERE oi.order_id = o.id)
                    - coalesce(o.returned_quantity, 0)) * ref.commission_per_unit_usd
                ),
                'status', o.status
            ) ORDER BY o.created_at DESC), '[]'::json)
            FROM public.orders o
            JOIN public.retailers ret ON ret.id = o.retailer_id
            JOIN public.retailer_referrals ref ON ref.retailer_id = o.retailer_id
            WHERE (ref.agent_id = v_target_agent_id OR ref.referrer_name ILIKE v_agent_record.name)
              AND o.status = 'Finalizado'
              AND (p_start_date IS NULL OR o.created_at >= p_start_date)
              AND (p_end_date IS NULL OR o.created_at <= p_end_date)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;
