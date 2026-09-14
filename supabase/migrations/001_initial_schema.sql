-- RISEMOBILE: Migration 001 - Initial Schema
-- Criado pelo Agente de Backend e Supabase

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Grades
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    badge_color VARCHAR(30) DEFAULT 'lavender',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Entradas de Estoque em Lote
CREATE TABLE IF NOT EXISTS public.stock_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_code VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    storage VARCHAR(50) NOT NULL,
    grade_id UUID REFERENCES public.grades(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_cost_usd NUMERIC(12, 2) NOT NULL CHECK (total_cost_usd >= 0),
    unit_cost_usd NUMERIC(12, 2) NOT NULL CHECK (unit_cost_usd >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Aparelhos (Dispositivos Individuais)
-- Regra Crítica: IMEI/Serial único no banco de dados
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de performance para buscas frequentes e seleção automática
CREATE INDEX IF NOT EXISTS idx_devices_lookup ON public.devices (model, storage, grade_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_imei ON public.devices (imei);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices (status);

-- 4. Tabela de Lojistas
CREATE TABLE IF NOT EXISTS public.retailers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    whatsapp VARCHAR(30) NOT NULL,
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

-- 5. Tabela de Pedidos
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

-- 6. Tabela de Itens do Pedido
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

-- 7. Tabela de Alocação de Aparelhos ao Pedido (Impede Dupla Reserva no Banco)
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

CREATE INDEX IF NOT EXISTS idx_order_device_alloc_order ON public.order_device_allocations (order_id);
CREATE INDEX IF NOT EXISTS idx_order_device_alloc_device ON public.order_device_allocations (device_id);

-- 8. Tabela de Pagamentos
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

-- 9. Tabela de Parcelas (Contas a Receber)
CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
    installment_number INTEGER NOT NULL CHECK (installment_number > 0),
    amount_usd NUMERIC(12, 2) NOT NULL CHECK (amount_usd > 0),
    due_date DATE NOT NULL,
    payment_date TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'A vencer' 
        CHECK (status IN ('A vencer', 'Vence hoje', 'Pago', 'Vencido')),
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments (status, due_date);
CREATE INDEX IF NOT EXISTS idx_installments_retailer ON public.installments (retailer_id);

-- 10. Tabela de Comissões
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

-- 11. Tabela de Movimentações de Estoque (Histórico Completo Perpétuo)
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

CREATE INDEX IF NOT EXISTS idx_stock_movements_device ON public.stock_movements (device_id);

-- 12. Tabela de Ajustes de Estoque (Retirada sem venda)
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
    reason VARCHAR(50) NOT NULL 
        CHECK (reason IN ('Defeito', 'Garantia', 'Uso Interno', 'Descarte', 'Extravio', 'Outros')),
    notes TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Tabela de Logs de Auditoria
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs (table_name, record_id);

-- 14. Configurações Globais do Sistema
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
