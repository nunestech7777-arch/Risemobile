-- ============================================================================
-- RISEMOBILE — CONSOLIDATED DATABASE SETUP (MIGRATIONS 001 A 004)
-- Execute este script completo no SQL Editor do seu painel Supabase
-- ============================================================================

-- 1. EXTENSÃO UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELAS PRINCIPAIS
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    badge_color VARCHAR(30) DEFAULT 'lavender',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_code VARCHAR(100) NOT NULL,
    -- model/storage/unit_cost_usd: preenchidos apenas em lotes legados de
    -- configuração única. Lotes novos são multi-item (ver stock_entry_items)
    -- e deixam esses campos nulos, guardando apenas quantidade/custo agregados.
    model VARCHAR(100),
    storage VARCHAR(50),
    grade_id UUID REFERENCES public.grades(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_cost_usd NUMERIC(12, 2) NOT NULL CHECK (total_cost_usd >= 0),
    unit_cost_usd NUMERIC(12, 2) CHECK (unit_cost_usd >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Itens/configurações de um lote multi-modelo (1 lote -> N itens -> N devices)
CREATE TABLE IF NOT EXISTS public.stock_entry_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_entry_id UUID NOT NULL REFERENCES public.stock_entries(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    storage VARCHAR(50) NOT NULL,
    grade_id UUID NOT NULL REFERENCES public.grades(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost_usd >= 0),
    suggested_price_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (suggested_price_usd >= 0),
    total_cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_cost_usd >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_entry_items_entry ON public.stock_entry_items (stock_entry_id);

CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100),
    external_source VARCHAR(100) DEFAULT 'EXTERNAL_SYSTEM',
    external_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(50) DEFAULT 'synced',
    model VARCHAR(100) NOT NULL,
    storage VARCHAR(50) NOT NULL,
    grade_id UUID NOT NULL REFERENCES public.grades(id) ON DELETE RESTRICT,
    color VARCHAR(50) NOT NULL,
    battery_health INTEGER NOT NULL CHECK (battery_health >= 0 AND battery_health <= 100),
    imei VARCHAR(30) NOT NULL UNIQUE,
    cost_price_usd NUMERIC(12, 2) NOT NULL CHECK (cost_price_usd >= 0),
    suggested_price_usd NUMERIC(12, 2) NOT NULL CHECK (suggested_price_usd >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'Disponível' 
        CHECK (status IN ('Disponível', 'Reservado', 'Vendido', 'Retirado por ajuste')),
    stock_entry_id UUID REFERENCES public.stock_entries(id) ON DELETE SET NULL,
    stock_entry_item_id UUID REFERENCES public.stock_entry_items(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_lookup ON public.devices (model, storage, grade_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_imei ON public.devices (imei);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_external_id_unique ON public.devices (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_sync_status ON public.devices (sync_status, last_synced_at);

CREATE TABLE IF NOT EXISTS public.retailers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(150),
    phone VARCHAR(30),
    whatsapp VARCHAR(30),
    document VARCHAR(50),
    city VARCHAR(100),
    state VARCHAR(10),
    address TEXT,
    commission_per_unit_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (commission_per_unit_usd >= 0),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retailers_store_name ON public.retailers (store_name);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'Rascunho' 
        CHECK (status IN ('Rascunho', 'Reservado', 'Em Separação', 'Finalizado', 'Cancelado')),
    total_amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount_usd >= 0),
    paid_amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount_usd >= 0),
    balance_due_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance_due_usd >= 0),
    total_commission_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_commission_usd >= 0),
    total_profit_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reserved_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_retailer ON public.orders (retailer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    storage VARCHAR(50) NOT NULL,
    grade_id UUID NOT NULL REFERENCES public.grades(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_usd NUMERIC(12, 2) NOT NULL CHECK (unit_price_usd >= 0),
    total_price_usd NUMERIC(12, 2) NOT NULL CHECK (total_price_usd >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_device_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    device_id UUID NOT NULL UNIQUE REFERENCES public.devices(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'Reservado' 
        CHECK (status IN ('Reservado', 'Separado', 'Vendido')),
    scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
    amount_usd NUMERIC(12, 2) NOT NULL CHECK (amount_usd > 0),
    amount_brl NUMERIC(12, 2) CHECK (amount_brl >= 0),
    exchange_rate NUMERIC(10, 4) DEFAULT 1.0000,
    payment_method VARCHAR(50) NOT NULL 
        CHECK (payment_method IN ('PIX', 'Cartão', 'Dólar', 'A Prazo', 'Misto', 'Boleto', 'Transferência')),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
    installment_number INTEGER NOT NULL CHECK (installment_number > 0),
    amount_usd NUMERIC(12, 2) NOT NULL CHECK (amount_usd >= 0),
    due_date DATE NOT NULL,
    payment_date TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'A vencer'
        CHECK (status IN ('A vencer', 'Vence hoje', 'Pago', 'Vencido')),
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments (status, due_date);

CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
    total_units INTEGER NOT NULL CHECK (total_units > 0),
    rate_per_unit_usd NUMERIC(10, 2) NOT NULL CHECK (rate_per_unit_usd >= 0),
    total_commission_usd NUMERIC(12, 2) NOT NULL CHECK (total_commission_usd >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'Registrado',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Comissionados / Indicadores
CREATE TABLE IF NOT EXISTS public.commission_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_agents_email ON public.commission_agents (email);
CREATE INDEX IF NOT EXISTS idx_commission_agents_name ON public.commission_agents (name);

-- Tabela de Indicações de Lojistas
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

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    movement_type VARCHAR(50) NOT NULL 
        CHECK (movement_type IN ('Entrada', 'Reserva', 'Cancelamento de Reserva', 'Separação', 'Venda', 'Ajuste', 'Retorno')),
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
    reason VARCHAR(50) NOT NULL 
        CHECK (reason IN ('Defeito', 'Garantia', 'Uso Interno', 'Descarte', 'Extravio', 'Outros')),
    notes TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    action VARCHAR(30) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    performed_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. HABILITAR RLS
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_entry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_device_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS PÚBLICAS/AUTENTICADAS
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated full access" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow anon full access dev" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Allow anon full access dev" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- 4. RPCS TRANSACIONAIS
CREATE OR REPLACE FUNCTION public.rpc_reserve_devices_for_order(
    p_order_id UUID DEFAULT NULL,
    p_retailer_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::JSONB,
    p_notes TEXT DEFAULT '',
    p_order_number VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID := p_order_id;
    v_retailer_id UUID := p_retailer_id;
    v_item JSONB;
    v_model VARCHAR;
    v_storage VARCHAR;
    v_grade_id UUID;
    v_qty INTEGER;
    v_unit_price NUMERIC;
    v_order_item_id UUID;
    v_device RECORD;
    v_allocated_count INTEGER;
    v_total_amount NUMERIC := 0;
    v_total_commission NUMERIC := 0;
    v_commission_rate NUMERIC := 0;
    v_total_units INTEGER := 0;
    v_result_devices JSONB := '[]'::JSONB;
    v_order_num VARCHAR := p_order_number;
BEGIN
    -- Se p_order_id for informado, busca o lojista do pedido existente
    IF v_order_id IS NOT NULL THEN
        SELECT retailer_id INTO v_retailer_id FROM public.orders WHERE id = v_order_id;
        IF v_retailer_id IS NULL THEN
            RAISE EXCEPTION 'Pedido com ID % não encontrado.', v_order_id;
        END IF;
    ELSE
        -- Se p_order_id for nulo, p_retailer_id deve ser fornecido para criar o pedido
        IF v_retailer_id IS NULL THEN
            RAISE EXCEPTION 'ID do lojista ou ID do pedido deve ser fornecido.';
        END IF;
    END IF;

    -- Obter taxa de comissão por unidade do lojista
    SELECT COALESCE(commission_per_unit_usd, 0) INTO v_commission_rate 
    FROM public.retailers WHERE id = v_retailer_id;

    -- Calcular totais primeiro para criar o pedido com valores corretos se for novo
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 1);
        v_unit_price := COALESCE((v_item->>'unit_price_usd')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);
        v_total_amount := v_total_amount + (v_qty * v_unit_price);
        v_total_units := v_total_units + v_qty;
    END LOOP;

    v_total_commission := v_total_units * v_commission_rate;

    -- Se for um novo pedido, cria em public.orders
    IF v_order_id IS NULL THEN
        IF v_order_num IS NULL OR v_order_num = '' THEN
            v_order_num := 'PED-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
        END IF;

        INSERT INTO public.orders (
            order_number,
            retailer_id,
            status,
            total_amount_usd,
            paid_amount_usd,
            balance_due_usd,
            total_commission_usd,
            total_profit_usd,
            notes,
            reserved_at
        ) VALUES (
            v_order_num,
            v_retailer_id,
            'Reservado',
            v_total_amount,
            0,
            v_total_amount,
            v_total_commission,
            0,
            p_notes,
            NOW()
        )
        RETURNING id INTO v_order_id;
    ELSE
        -- Limpar itens e alocações anteriores caso seja uma re-reserva de pedido existente
        DELETE FROM public.order_device_allocations WHERE order_id = v_order_id;
        DELETE FROM public.order_items WHERE order_id = v_order_id;
        
        UPDATE public.orders 
        SET total_amount_usd = v_total_amount,
            balance_due_usd = v_total_amount - paid_amount_usd,
            total_commission_usd = v_total_commission,
            status = 'Reservado',
            updated_at = NOW()
        WHERE id = v_order_id;
    END IF;

    -- Iterar sobre os itens e alocar aparelhos disponíveis por maior bateria
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_model := v_item->>'model';
        v_storage := v_item->>'storage';
        v_grade_id := NULL;
        IF (v_item->>'grade_id') IS NOT NULL AND (v_item->>'grade_id') <> '' THEN
            v_grade_id := (v_item->>'grade_id')::UUID;
        END IF;
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 1);
        v_unit_price := COALESCE((v_item->>'unit_price_usd')::NUMERIC, (v_item->>'unit_price')::NUMERIC, 0);

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida (%) para o item % %', v_qty, v_model, v_storage;
        END IF;

        -- Inserir item do pedido
        INSERT INTO public.order_items (
            order_id, model, storage, grade_id, quantity, unit_price_usd, total_price_usd
        ) VALUES (
            v_order_id, v_model, v_storage, v_grade_id, v_qty, v_unit_price, (v_qty * v_unit_price)
        )
        RETURNING id INTO v_order_item_id;

        -- Selecionar aparelhos disponíveis ordenados por maior saúde de bateria com lock pessimista
        v_allocated_count := 0;
        FOR v_device IN 
            SELECT id, imei, battery_health, color, cost_price_usd
            FROM public.devices
            WHERE model = v_model 
              AND storage = v_storage 
              AND (v_grade_id IS NULL OR grade_id = v_grade_id)
              AND status = 'Disponível'
            ORDER BY battery_health DESC NULLS LAST, created_at ASC
            LIMIT v_qty
            FOR UPDATE SKIP LOCKED
        LOOP
            -- 1. Alocar aparelho ao pedido
            INSERT INTO public.order_device_allocations (order_id, order_item_id, device_id, status)
            VALUES (v_order_id, v_order_item_id, v_device.id, 'Reservado');

            -- 2. Atualizar status do dispositivo para Reservado
            UPDATE public.devices 
            SET status = 'Reservado', updated_at = NOW() 
            WHERE id = v_device.id;

            -- 3. Registrar movimentação de estoque
            INSERT INTO public.stock_movements (
                device_id, order_id, movement_type, previous_status, new_status, reason
            ) VALUES (
                v_device.id, v_order_id, 'Reserva', 'Disponível', 'Reservado', 'Reserva automática para pedido ' || v_order_num
            );

            v_result_devices := v_result_devices || jsonb_build_object(
                'device_id', v_device.id,
                'imei', v_device.imei,
                'model', v_model,
                'storage', v_storage,
                'color', v_device.color,
                'battery_health', v_device.battery_health,
                'cost_price_usd', v_device.cost_price_usd,
                'separated', false
            );

            v_allocated_count := v_allocated_count + 1;
        END LOOP;

        IF v_allocated_count < v_qty THEN
            RAISE EXCEPTION 'Estoque insuficiente para o modelo % % (solicitados: %, disponíveis: %)', 
                v_model, v_storage, v_qty, v_allocated_count;
        END IF;
    END LOOP;

    -- Registrar log de auditoria
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, performed_by)
    VALUES (
        'orders', 
        v_order_id, 
        'RESERVE_ORDER', 
        jsonb_build_object(
            'order_id', v_order_id, 
            'total_amount', v_total_amount, 
            'allocated_devices', v_result_devices
        ),
        'system'
    );

    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_id', v_order_id,
        'order_number', v_order_num,
        'retailer_id', v_retailer_id,
        'status', 'Reservado',
        'total_amount_usd', v_total_amount,
        'total_units', v_total_units,
        'total_commission_usd', v_total_commission,
        'allocated_devices', v_result_devices
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_cancel_order(
    p_order_id UUID,
    p_reason TEXT DEFAULT 'Cancelado pelo usuário'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alloc RECORD;
    v_released_count INTEGER := 0;
BEGIN
    FOR v_alloc IN 
        SELECT device_id FROM public.order_device_allocations WHERE order_id = p_order_id
    LOOP
        UPDATE public.devices 
        SET status = 'Disponível', updated_at = NOW() 
        WHERE id = v_alloc.device_id;

        INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason)
        VALUES (v_alloc.device_id, p_order_id, 'Cancelamento de Reserva', 'Reservado', 'Disponível', p_reason);

        v_released_count := v_released_count + 1;
    END LOOP;

    DELETE FROM public.order_device_allocations WHERE order_id = p_order_id;

    UPDATE public.orders
    SET status = 'Cancelado',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'released_count', v_released_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_finalize_order_sale(
    p_order_id UUID,
    p_payments JSONB,
    p_installments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_alloc RECORD;
    v_payment JSONB;
    v_installment JSONB;
    v_total_cost NUMERIC := 0;
    v_total_profit NUMERIC := 0;
    v_total_paid NUMERIC := 0;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido % não encontrado', p_order_id;
    END IF;

    IF v_order.status IN ('Finalizado', 'Parcialmente Devolvida', 'Totalmente Devolvida') THEN
        RAISE EXCEPTION 'Pedido % já foi finalizado anteriormente', v_order.order_number;
    END IF;

    IF v_order.status = 'Cancelado' THEN
        RAISE EXCEPTION 'Pedido % está cancelado e não pode ser finalizado', v_order.order_number;
    END IF;

    FOR v_alloc IN
        SELECT oda.device_id, d.cost_price_usd 
        FROM public.order_device_allocations oda
        JOIN public.devices d ON d.id = oda.device_id
        WHERE oda.order_id = p_order_id
    LOOP
        v_total_cost := v_total_cost + v_alloc.cost_price_usd;

        UPDATE public.devices 
        SET status = 'Vendido', updated_at = NOW() 
        WHERE id = v_alloc.device_id;

        UPDATE public.order_device_allocations
        SET status = 'Vendido'
        WHERE order_id = p_order_id AND device_id = v_alloc.device_id;

        INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason)
        VALUES (v_alloc.device_id, p_order_id, 'Venda', 'Reservado', 'Vendido', 'Venda finalizada no pedido ' || v_order.order_number);
    END LOOP;

    IF p_payments IS NOT NULL AND jsonb_array_length(p_payments) > 0 THEN
        FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
        LOOP
            INSERT INTO public.payments (
                order_id, retailer_id, amount_usd, amount_brl, exchange_rate, payment_method, notes
            ) VALUES (
                p_order_id, 
                v_order.retailer_id, 
                (v_payment->>'amount_usd')::NUMERIC,
                COALESCE((v_payment->>'amount_brl')::NUMERIC, (v_payment->>'amount_usd')::NUMERIC * COALESCE((v_payment->>'exchange_rate')::NUMERIC, 1.0)),
                COALESCE((v_payment->>'exchange_rate')::NUMERIC, 1.0000),
                v_payment->>'method',
                v_payment->>'notes'
            );

            v_total_paid := v_total_paid + (v_payment->>'amount_usd')::NUMERIC;
        END LOOP;
    END IF;

    IF p_installments IS NOT NULL AND jsonb_array_length(p_installments) > 0 THEN
        FOR v_installment IN SELECT * FROM jsonb_array_elements(p_installments)
        LOOP
            INSERT INTO public.installments (
                order_id, retailer_id, installment_number, amount_usd, due_date, status
            ) VALUES (
                p_order_id,
                v_order.retailer_id,
                (v_installment->>'number')::INTEGER,
                (v_installment->>'amount_usd')::NUMERIC,
                (v_installment->>'due_date')::DATE,
                CASE 
                    WHEN (v_installment->>'due_date')::DATE < CURRENT_DATE THEN 'Vencido'
                    WHEN (v_installment->>'due_date')::DATE = CURRENT_DATE THEN 'Vence hoje'
                    ELSE 'A vencer'
                END
            );
        END LOOP;
    END IF;

    v_total_profit := v_order.total_amount_usd - v_total_cost;

    UPDATE public.orders
    SET status = 'Finalizado',
        paid_amount_usd = v_total_paid,
        balance_due_usd = GREATEST(0, total_amount_usd - v_total_paid),
        total_profit_usd = v_total_profit,
        finalized_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'total_cost_usd', v_total_cost,
        'total_profit_usd', v_total_profit,
        'balance_due_usd', GREATEST(0, v_order.total_amount_usd - v_total_paid)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_adjust_device_stock(
    p_device_id UUID,
    p_reason VARCHAR,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev_status VARCHAR;
BEGIN
    SELECT status INTO v_prev_status FROM public.devices WHERE id = p_device_id FOR UPDATE;
    IF v_prev_status IS NULL THEN
        RAISE EXCEPTION 'Aparelho % não encontrado', p_device_id;
    END IF;

    IF v_prev_status = 'Vendido' THEN
        RAISE EXCEPTION 'Não é permitido retirar por ajuste um aparelho já Vendido';
    END IF;

    UPDATE public.devices
    SET status = 'Retirado por ajuste', updated_at = NOW()
    WHERE id = p_device_id;

    INSERT INTO public.stock_adjustments (device_id, reason, notes)
    VALUES (p_device_id, p_reason, p_notes);

    INSERT INTO public.stock_movements (device_id, movement_type, previous_status, new_status, reason, notes)
    VALUES (p_device_id, 'Ajuste', v_prev_status, 'Retirado por ajuste', p_reason, p_notes);

    RETURN jsonb_build_object('success', true, 'device_id', p_device_id);
END;
$$;

-- 5. RPC: Sincronização / UPSERT Idempotente de Aparelhos de Sistema Externo
CREATE OR REPLACE FUNCTION public.rpc_sync_external_devices(
    p_devices JSONB,
    p_source VARCHAR DEFAULT 'EXTERNAL_SYSTEM'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_external_id VARCHAR;
    v_imei VARCHAR;
    v_model VARCHAR;
    v_storage VARCHAR;
    v_grade_id UUID;
    v_color VARCHAR;
    v_battery INTEGER;
    v_cost NUMERIC;
    v_suggested NUMERIC;
    v_existing_id UUID;
    v_existing_status VARCHAR;
    v_inserted_count INTEGER := 0;
    v_updated_count INTEGER := 0;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_devices)
    LOOP
        v_external_id := v_item->>'external_id';
        v_imei := v_item->>'imei';
        v_model := v_item->>'model';
        v_storage := v_item->>'storage';
        v_grade_id := (v_item->>'grade_id')::UUID;
        v_color := COALESCE(v_item->>'color', 'Padrão');
        v_battery := COALESCE((v_item->>'battery_health')::INTEGER, 100);
        v_cost := COALESCE((v_item->>'cost_price_usd')::NUMERIC, 0.00);
        v_suggested := COALESCE((v_item->>'suggested_price_usd')::NUMERIC, v_cost * 1.25);

        IF v_imei IS NULL OR v_model IS NULL OR v_storage IS NULL THEN
            CONTINUE;
        END IF;

        SELECT id, status INTO v_existing_id, v_existing_status 
        FROM public.devices 
        WHERE (v_external_id IS NOT NULL AND external_id = v_external_id)
           OR imei = v_imei
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            UPDATE public.devices
            SET 
                external_id = COALESCE(v_external_id, external_id),
                external_source = p_source,
                model = v_model,
                storage = v_storage,
                grade_id = COALESCE(v_grade_id, grade_id),
                color = v_color,
                battery_health = v_battery,
                cost_price_usd = v_cost,
                suggested_price_usd = v_suggested,
                last_synced_at = NOW(),
                sync_status = 'synced',
                updated_at = NOW()
            WHERE id = v_existing_id;

            v_updated_count := v_updated_count + 1;
        ELSE
            INSERT INTO public.devices (
                external_id,
                external_source,
                model,
                storage,
                grade_id,
                color,
                battery_health,
                imei,
                cost_price_usd,
                suggested_price_usd,
                status,
                last_synced_at,
                sync_status,
                created_at,
                updated_at
            ) VALUES (
                v_external_id,
                p_source,
                v_model,
                v_storage,
                v_grade_id,
                v_color,
                v_battery,
                v_imei,
                v_cost,
                v_suggested,
                'Disponível',
                NOW(),
                'synced',
                NOW(),
                NOW()
            ) RETURNING id INTO v_existing_id;

            INSERT INTO public.stock_movements (
                device_id,
                movement_type,
                previous_status,
                new_status,
                reason
            ) VALUES (
                v_existing_id,
                'Entrada',
                NULL,
                'Disponível',
                'Sincronização com Sistema Externo (' || p_source || ')'
            );

            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_data)
    VALUES ('devices', NULL, 'RPC_SYNC_EXTERNAL_DEVICES', jsonb_build_object(
        'source', p_source,
        'inserted_count', v_inserted_count,
        'updated_count', v_updated_count,
        'total_processed', v_inserted_count + v_updated_count
    ));

    RETURN jsonb_build_object(
        'success', true,
        'inserted_count', v_inserted_count,
        'updated_count', v_updated_count,
        'total_processed', v_inserted_count + v_updated_count
    );
END;
$$;

-- 6. Função RPC para Entrada Manual de Lote Atômica (RiseMobile Native Entry)
CREATE OR REPLACE FUNCTION public.rpc_create_stock_entry_batch(
    p_reference_code VARCHAR,
    p_model VARCHAR,
    p_storage VARCHAR,
    p_grade_id UUID,
    p_quantity INTEGER,
    p_unit_cost_usd NUMERIC,
    p_suggested_price_usd NUMERIC,
    p_notes TEXT,
    p_created_by VARCHAR,
    p_source VARCHAR,
    p_units JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_entry_id UUID;
    v_total_cost NUMERIC := 0;
    v_unit JSONB;
    v_imei VARCHAR;
    v_color VARCHAR;
    v_battery INTEGER;
    v_cost NUMERIC;
    v_price NUMERIC;
    v_inserted_device_id UUID;
    v_devices_created JSONB := '[]'::JSONB;
    v_actual_count INTEGER := 0;
    v_existing_id UUID;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'A quantidade do lote deve ser maior que zero.';
    END IF;

    IF jsonb_array_length(p_units) <> p_quantity THEN
        RAISE EXCEPTION 'A quantidade de unidades no array (%) não corresponde à quantidade informada no lote (%).', 
            jsonb_array_length(p_units), p_quantity;
    END IF;

    FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units)
    LOOP
        v_imei := TRIM(v_unit->>'imei');
        IF v_imei IS NULL OR v_imei = '' THEN
            RAISE EXCEPTION 'Todas as unidades devem possuir um IMEI ou Serial válido.';
        END IF;

        SELECT id INTO v_existing_id FROM public.devices WHERE imei = v_imei LIMIT 1;
        IF v_existing_id IS NOT NULL THEN
            RAISE EXCEPTION 'O IMEI % já está cadastrado no sistema (Conflito com ID: %).', v_imei, v_existing_id;
        END IF;

        v_cost := COALESCE((v_unit->>'cost_price_usd')::NUMERIC, p_unit_cost_usd);
        v_total_cost := v_total_cost + v_cost;
    END LOOP;

    INSERT INTO public.stock_entries (
        reference_code,
        model,
        storage,
        grade_id,
        quantity,
        total_cost_usd,
        unit_cost_usd,
        suggested_price_usd,
        notes,
        created_by,
        source,
        created_at
    ) VALUES (
        p_reference_code,
        p_model,
        p_storage,
        p_grade_id,
        p_quantity,
        v_total_cost,
        p_unit_cost_usd,
        p_suggested_price_usd,
        p_notes,
        COALESCE(p_created_by, 'admin'),
        COALESCE(p_source, 'manual'),
        NOW()
    ) RETURNING id INTO v_stock_entry_id;

    FOR v_unit IN SELECT * FROM jsonb_array_elements(p_units)
    LOOP
        v_imei := TRIM(v_unit->>'imei');
        v_color := COALESCE(v_unit->>'color', 'Padrão');
        v_battery := COALESCE((v_unit->>'battery_health')::INTEGER, 100);
        v_cost := COALESCE((v_unit->>'cost_price_usd')::NUMERIC, p_unit_cost_usd);
        v_price := COALESCE((v_unit->>'suggested_price_usd')::NUMERIC, p_suggested_price_usd);

        INSERT INTO public.devices (
            model,
            storage,
            grade_id,
            color,
            battery_health,
            imei,
            cost_price_usd,
            suggested_price_usd,
            status,
            stock_entry_id,
            source,
            created_at,
            updated_at
        ) VALUES (
            p_model,
            p_storage,
            p_grade_id,
            v_color,
            v_battery,
            v_imei,
            v_cost,
            v_price,
            'Disponível',
            v_stock_entry_id,
            COALESCE(p_source, 'manual'),
            NOW(),
            NOW()
        ) RETURNING id INTO v_inserted_device_id;

        INSERT INTO public.stock_movements (
            device_id,
            movement_type,
            previous_status,
            new_status,
            reason,
            notes,
            created_at
        ) VALUES (
            v_inserted_device_id,
            'Entrada',
            NULL,
            'Disponível',
            'Entrada de Estoque (Lote: ' || p_reference_code || ')',
            'Entrada registrada por ' || COALESCE(p_created_by, 'admin'),
            NOW()
        );

        v_devices_created := v_devices_created || jsonb_build_object(
            'id', v_inserted_device_id,
            'imei', v_imei,
            'model', p_model,
            'storage', p_storage,
            'color', v_color,
            'battery_health', v_battery,
            'cost_price_usd', v_cost,
            'suggested_price_usd', v_price
        );

        v_actual_count := v_actual_count + 1;
    END LOOP;

    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        new_data,
        performed_by,
        created_at
    ) VALUES (
        'stock_entries',
        v_stock_entry_id,
        'RPC_CREATE_STOCK_ENTRY_BATCH',
        jsonb_build_object(
            'stock_entry_id', v_stock_entry_id,
            'reference_code', p_reference_code,
            'quantity', p_quantity,
            'total_cost_usd', v_total_cost,
            'source', COALESCE(p_source, 'manual'),
            'devices_created', v_devices_created
        ),
        COALESCE(p_created_by, 'admin'),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'stock_entry_id', v_stock_entry_id,
        'reference_code', p_reference_code,
        'quantity', v_actual_count,
        'total_cost_usd', v_total_cost,
        'devices', v_devices_created
    );
END;
$$;

-- 6b. RPC: Entrada de Lote com Múltiplos Itens/Modelos (ver migration 011)
CREATE OR REPLACE FUNCTION public.rpc_create_stock_entry_batch_multi(
    p_reference_code VARCHAR,
    p_notes TEXT,
    p_created_by VARCHAR,
    p_source VARCHAR,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_entry_id UUID;
    v_item JSONB;
    v_unit JSONB;
    v_item_id UUID;
    v_imei VARCHAR;
    v_color VARCHAR;
    v_battery INTEGER;
    v_cost NUMERIC;
    v_price NUMERIC;
    v_item_unit_cost NUMERIC;
    v_item_suggested_price NUMERIC;
    v_item_total_cost NUMERIC;
    v_grand_total_cost NUMERIC := 0;
    v_grand_total_qty INTEGER := 0;
    v_inserted_device_id UUID;
    v_existing_id UUID;
    v_seen_imeis TEXT[] := ARRAY[]::TEXT[];
    v_items_result JSONB := '[]'::JSONB;
    v_item_devices JSONB;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'O lote precisa conter ao menos um item/configuração.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        FOR v_unit IN SELECT * FROM jsonb_array_elements(v_item->'units')
        LOOP
            v_imei := TRIM(v_unit->>'imei');
            IF v_imei IS NULL OR v_imei = '' THEN
                RAISE EXCEPTION 'Todas as unidades devem possuir um IMEI ou Serial válido.';
            END IF;

            IF v_imei = ANY(v_seen_imeis) THEN
                RAISE EXCEPTION 'IMEI % está duplicado entre itens/configurações do mesmo lote.', v_imei;
            END IF;
            v_seen_imeis := array_append(v_seen_imeis, v_imei);

            SELECT id INTO v_existing_id FROM public.devices WHERE imei = v_imei LIMIT 1;
            IF v_existing_id IS NOT NULL THEN
                RAISE EXCEPTION 'O IMEI % já está cadastrado no sistema (Conflito com ID: %).', v_imei, v_existing_id;
            END IF;
        END LOOP;
    END LOOP;

    INSERT INTO public.stock_entries (reference_code, quantity, total_cost_usd, notes, created_by, source, created_at)
    VALUES (p_reference_code, 1, 0, p_notes, COALESCE(p_created_by, 'admin'), COALESCE(p_source, 'manual'), NOW())
    RETURNING id INTO v_stock_entry_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_unit_cost := COALESCE((v_item->>'unit_cost_usd')::NUMERIC, 0);
        v_item_suggested_price := COALESCE((v_item->>'suggested_price_usd')::NUMERIC, 0);
        v_item_total_cost := 0;
        v_item_devices := '[]'::JSONB;

        INSERT INTO public.stock_entry_items (stock_entry_id, model, storage, grade_id, quantity, unit_cost_usd, suggested_price_usd, total_cost_usd)
        VALUES (
            v_stock_entry_id, v_item->>'model', v_item->>'storage', (v_item->>'grade_id')::UUID,
            jsonb_array_length(v_item->'units'), v_item_unit_cost, v_item_suggested_price, 0
        ) RETURNING id INTO v_item_id;

        FOR v_unit IN SELECT * FROM jsonb_array_elements(v_item->'units')
        LOOP
            v_imei := TRIM(v_unit->>'imei');
            v_color := COALESCE(v_unit->>'color', 'Padrão');
            v_battery := COALESCE((v_unit->>'battery_health')::INTEGER, 100);
            v_cost := COALESCE((v_unit->>'cost_price_usd')::NUMERIC, v_item_unit_cost);
            v_price := COALESCE((v_unit->>'suggested_price_usd')::NUMERIC, v_item_suggested_price);

            INSERT INTO public.devices (
                model, storage, grade_id, color, battery_health, imei,
                cost_price_usd, suggested_price_usd, status,
                stock_entry_id, stock_entry_item_id, source, created_at, updated_at
            ) VALUES (
                v_item->>'model', v_item->>'storage', (v_item->>'grade_id')::UUID, v_color, v_battery, v_imei,
                v_cost, v_price, 'Disponível', v_stock_entry_id, v_item_id, COALESCE(p_source, 'manual'), NOW(), NOW()
            ) RETURNING id INTO v_inserted_device_id;

            INSERT INTO public.stock_movements (device_id, movement_type, previous_status, new_status, reason, notes, created_at)
            VALUES (
                v_inserted_device_id, 'Entrada', NULL, 'Disponível',
                'Entrada de Estoque (Lote: ' || p_reference_code || ' — ' || (v_item->>'model') || ' ' || (v_item->>'storage') || ')',
                'Entrada registrada por ' || COALESCE(p_created_by, 'admin'), NOW()
            );

            v_item_total_cost := v_item_total_cost + v_cost;
            v_item_devices := v_item_devices || jsonb_build_object(
                'id', v_inserted_device_id, 'imei', v_imei, 'color', v_color,
                'battery_health', v_battery, 'cost_price_usd', v_cost, 'suggested_price_usd', v_price
            );
        END LOOP;

        UPDATE public.stock_entry_items SET total_cost_usd = v_item_total_cost WHERE id = v_item_id;
        v_grand_total_cost := v_grand_total_cost + v_item_total_cost;
        v_grand_total_qty := v_grand_total_qty + jsonb_array_length(v_item->'units');

        v_items_result := v_items_result || jsonb_build_object(
            'item_id', v_item_id, 'model', v_item->>'model', 'storage', v_item->>'storage',
            'grade_id', v_item->>'grade_id', 'quantity', jsonb_array_length(v_item->'units'),
            'total_cost_usd', v_item_total_cost, 'devices', v_item_devices
        );
    END LOOP;

    UPDATE public.stock_entries SET quantity = v_grand_total_qty, total_cost_usd = v_grand_total_cost WHERE id = v_stock_entry_id;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, performed_by, created_at)
    VALUES (
        'stock_entries', v_stock_entry_id, 'RPC_CREATE_STOCK_ENTRY_BATCH_MULTI',
        jsonb_build_object('stock_entry_id', v_stock_entry_id, 'reference_code', p_reference_code, 'items', v_items_result),
        COALESCE(p_created_by, 'admin'), NOW()
    );

    RETURN jsonb_build_object(
        'success', true, 'stock_entry_id', v_stock_entry_id, 'reference_code', p_reference_code,
        'total_items', jsonb_array_length(p_items), 'total_quantity', v_grand_total_qty,
        'total_cost_usd', v_grand_total_cost, 'items', v_items_result
    );
END;
$$;

-- 6c. RPC: Exclusão de Venda com Restauração Automática de Estoque
CREATE OR REPLACE FUNCTION public.rpc_delete_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_alloc RECORD;
    v_restored_count INTEGER := 0;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido % não encontrado', p_order_id;
    END IF;

    FOR v_alloc IN
        SELECT device_id, status FROM public.order_device_allocations WHERE order_id = p_order_id
    LOOP
        IF v_alloc.status != 'Devolvido' THEN
            UPDATE public.devices SET status = 'Disponível', updated_at = NOW() WHERE id = v_alloc.device_id;

            INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason)
            VALUES (v_alloc.device_id, p_order_id, 'Cancelamento de Reserva', v_alloc.status, 'Disponível', 'Venda ' || v_order.order_number || ' excluída pelo administrador');

            v_restored_count := v_restored_count + 1;
        END IF;
    END LOOP;

    DELETE FROM public.sale_return_items WHERE order_id = p_order_id;
    DELETE FROM public.sale_returns WHERE order_id = p_order_id;
    DELETE FROM public.payments WHERE order_id = p_order_id;
    DELETE FROM public.orders WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'restored_devices', v_restored_count);
END;
$$;

-- 7. SEED INICIAL DE DADOS
INSERT INTO public.grades (id, name, description, badge_color, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'A++', 'Impecável, sem marcas, bateria 88%+', 'mint', true),
    ('22222222-2222-2222-2222-222222222222', 'AB+', 'Excelente estado, micro-detalhes mínimos, bateria 85%+', 'lavender', true),
    ('33333333-3333-3333-3333-333333333333', 'B-', 'Sinais leves de uso estético, 100% funcional', 'butter', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.retailers (id, store_name, contact_name, phone, whatsapp, document, city, state, address, commission_per_unit_usd, notes)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'iStore Prime SP', 'Rodrigo Mendes', '+55 11 98888-1111', '5511988881111', '28.910.456/0001-89', 'São Paulo', 'SP', 'Rua Santa Ifigênia, 450 - Sala 12', 15.00, 'Cliente VIP - Alto volume semanal'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tech Apple Express RJ', 'Fernanda Lima', '+55 21 97777-2222', '5521977772222', '34.821.109/0001-44', 'Rio de Janeiro', 'RJ', 'Av. das Américas, 3500 - Barra', 20.00, 'Pagamentos sempre via PIX ou 50% em 15 dias'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Mega Imports Curitiba', 'Carlos Eduardo', '+55 41 99999-3333', '5541999993333', '19.554.321/0001-12', 'Curitiba', 'PR', 'Rua XV de Novembro, 1200', 12.00, 'Comprador frequente de lotes B- e AB+')
ON CONFLICT DO NOTHING;

INSERT INTO public.devices (id, model, storage, grade_id, color, battery_health, imei, cost_price_usd, suggested_price_usd, status)
VALUES 
    ('d1111111-1111-1111-1111-111111111101', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Meia-noite', 96, '354890123456781', 360.00, 440.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111102', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Estelar', 92, '354890123456782', 360.00, 440.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111103', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Azul', 89, '354890123456783', 360.00, 440.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111104', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Rosa', 94, '354890123456784', 360.00, 440.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111105', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Verde', 91, '354890123456785', 360.00, 440.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111106', 'iPhone 13', '128GB', '22222222-2222-2222-2222-222222222222', 'Meia-noite', 87, '354890123456786', 330.00, 410.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111107', 'iPhone 13', '128GB', '22222222-2222-2222-2222-222222222222', 'Estelar', 86, '354890123456787', 330.00, 410.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111108', 'iPhone 14', '128GB', '11111111-1111-1111-1111-111111111111', 'Roxo', 98, '354890123456788', 460.00, 560.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111109', 'iPhone 14', '128GB', '11111111-1111-1111-1111-111111111111', 'Azul', 95, '354890123456789', 460.00, 560.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111110', 'iPhone 14', '128GB', '11111111-1111-1111-1111-111111111111', 'Estelar', 91, '354890123456790', 460.00, 560.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111111', 'iPhone 14 Pro', '256GB', '11111111-1111-1111-1111-111111111111', 'Roxo-profundo', 93, '354890123456791', 650.00, 780.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111112', 'iPhone 14 Pro', '256GB', '11111111-1111-1111-1111-111111111111', 'Preto-espacial', 90, '354890123456792', 650.00, 780.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111113', 'iPhone 15 Pro', '128GB', '11111111-1111-1111-1111-111111111111', 'Titânio Natural', 99, '354890123456793', 780.00, 920.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111114', 'iPhone 15 Pro', '128GB', '11111111-1111-1111-1111-111111111111', 'Titânio Azul', 97, '354890123456794', 780.00, 920.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111115', 'iPhone 15 Pro', '128GB', '11111111-1111-1111-1111-111111111111', 'Titânio Preto', 95, '354890123456795', 780.00, 920.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111116', 'iPhone 15 Pro Max', '256GB', '11111111-1111-1111-1111-111111111111', 'Titânio Natural', 100, '354890123456796', 920.00, 1090.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111117', 'iPhone 15 Pro Max', '256GB', '11111111-1111-1111-1111-111111111111', 'Titânio Branco', 98, '354890123456797', 920.00, 1090.00, 'Disponível')
ON CONFLICT (imei) DO NOTHING;

INSERT INTO public.settings (key, value)
VALUES 
    ('system_config', '{"app_name": "RiseMobile", "base_currency": "USD", "usd_to_brl_rate": 5.48, "company_name": "RiseMobile Wholesale Ltd."}')
ON CONFLICT (key) DO NOTHING;

-- PERMISSÕES DE EXECUÇÃO DE RPCS
GRANT EXECUTE ON FUNCTION public.rpc_reserve_devices_for_order(UUID, UUID, JSONB, TEXT, VARCHAR) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_order(UUID, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finalize_order_sale(UUID, JSONB, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_adjust_device_stock(UUID, VARCHAR, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_stock_entry_batch(VARCHAR, VARCHAR, VARCHAR, UUID, INTEGER, NUMERIC, NUMERIC, TEXT, VARCHAR, VARCHAR, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_stock_entry_batch_multi(VARCHAR, TEXT, VARCHAR, VARCHAR, JSONB) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_delete_order(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_sync_external_devices(JSONB, VARCHAR, VARCHAR) TO authenticated, anon, service_role;

