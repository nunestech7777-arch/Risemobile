-- ==============================================================================
-- RISEMOBILE: Migration 009 - Devolução de Aparelhos em Vendas Finalizadas
-- Permite devolver um ou mais aparelhos específicos de um pedido já
-- finalizado, sem cancelar a venda, ajustando estoque, faturamento,
-- comissão e financeiro de forma transacional e rastreável.
-- ==============================================================================

-- 1. NOVOS STATUS DE PEDIDO (mantém o pedido, nunca cancela por devolução)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('Rascunho', 'Reservado', 'Em Separação', 'Finalizado', 'Cancelado', 'Parcialmente Devolvida', 'Totalmente Devolvida'));

-- 2. NOVO STATUS DE ALOCAÇÃO DE APARELHO ('Devolvido')
ALTER TABLE public.order_device_allocations DROP CONSTRAINT IF EXISTS order_device_allocations_status_check;
ALTER TABLE public.order_device_allocations ADD CONSTRAINT order_device_allocations_status_check
    CHECK (status IN ('Reservado', 'Separado', 'Vendido', 'Devolvido'));

-- 3. CAMPOS DE RASTREABILIDADE DE DEVOLUÇÃO NO PEDIDO
-- total_amount_usd / total_commission_usd permanecem como o valor BRUTO histórico.
-- returned_* acumulam o que foi devolvido. O valor líquido é sempre calculado
-- como total - returned (nunca sobrescrevemos o histórico bruto).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS returned_amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS returned_commission_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS credit_due_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- 4. TABELAS DE DEVOLUÇÃO
CREATE TABLE IF NOT EXISTS public.sale_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
    reason VARCHAR(50) NOT NULL
        CHECK (reason IN ('Troca solicitada', 'Defeito', 'Erro de modelo', 'Erro de grade', 'Erro de cor', 'Divergência', 'Outro')),
    notes TEXT,
    total_amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount_usd >= 0),
    total_commission_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_commission_usd >= 0),
    created_by VARCHAR(150) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_order ON public.sale_returns (order_id);

CREATE TABLE IF NOT EXISTS public.sale_return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
    imei VARCHAR(30) NOT NULL,
    model VARCHAR(100) NOT NULL,
    storage VARCHAR(50) NOT NULL,
    original_sale_price_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Um mesmo aparelho não pode ser devolvido duas vezes dentro do mesmo pedido
    UNIQUE (order_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON public.sale_return_items (return_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_device ON public.sale_return_items (device_id);

-- 5. RLS (mesmo padrão permissivo de desenvolvimento já aplicado às demais tabelas)
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access dev" ON public.sale_returns;
CREATE POLICY "Allow anon full access dev" ON public.sale_returns FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access dev" ON public.sale_return_items;
CREATE POLICY "Allow anon full access dev" ON public.sale_return_items FOR ALL USING (true) WITH CHECK (true);

-- 6. RPC TRANSACIONAL: REGISTRAR DEVOLUÇÃO DE APARELHO(S) DE UMA VENDA FINALIZADA
CREATE OR REPLACE FUNCTION public.rpc_register_sale_return(
    p_order_id UUID,
    p_device_ids UUID[],
    p_reason VARCHAR,
    p_notes TEXT,
    p_created_by VARCHAR DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_retailer RECORD;
    v_device_id UUID;
    v_alloc RECORD;
    v_unit_price NUMERIC;
    v_return_id UUID;
    v_total_returned_now NUMERIC := 0;
    v_commission_returned_now NUMERIC := 0;
    v_total_allocated INTEGER;
    v_total_returned_after INTEGER;
    v_new_returned_amount NUMERIC;
    v_new_returned_commission NUMERIC;
    v_net_total NUMERIC;
    v_new_balance_due NUMERIC;
    v_new_credit_due NUMERIC;
    v_new_status VARCHAR;
    v_open_installment RECORD;
    v_open_sum NUMERIC := 0;
    v_excess NUMERIC := 0;
    v_reduction NUMERIC;
BEGIN
    IF p_device_ids IS NULL OR array_length(p_device_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'Selecione ao menos um aparelho para devolução.';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido % não encontrado', p_order_id;
    END IF;

    IF v_order.status NOT IN ('Finalizado', 'Parcialmente Devolvida') THEN
        RAISE EXCEPTION 'Somente vendas Finalizadas ou Parcialmente Devolvidas podem receber devolução (status atual: %)', v_order.status;
    END IF;

    SELECT * INTO v_retailer FROM public.retailers WHERE id = v_order.retailer_id;

    -- Cria o registro de devolução (cabeçalho) primeiro, itens são inseridos no loop
    INSERT INTO public.sale_returns (order_id, retailer_id, reason, notes, created_by)
    VALUES (p_order_id, v_order.retailer_id, p_reason, p_notes, p_created_by)
    RETURNING id INTO v_return_id;

    FOREACH v_device_id IN ARRAY p_device_ids
    LOOP
        SELECT oda.*, d.imei, d.model, d.storage, d.grade_id INTO v_alloc
        FROM public.order_device_allocations oda
        JOIN public.devices d ON d.id = oda.device_id
        WHERE oda.order_id = p_order_id AND oda.device_id = v_device_id
        FOR UPDATE OF oda;

        IF v_alloc IS NULL THEN
            RAISE EXCEPTION 'Aparelho % não pertence ao pedido %', v_device_id, p_order_id;
        END IF;

        IF v_alloc.status = 'Devolvido' THEN
            RAISE EXCEPTION 'Aparelho % (IMEI %) já foi devolvido anteriormente', v_device_id, v_alloc.imei;
        END IF;

        IF v_alloc.status != 'Vendido' THEN
            RAISE EXCEPTION 'Aparelho % (IMEI %) não está com status Vendido e não pode ser devolvido', v_device_id, v_alloc.imei;
        END IF;

        -- Preço unitário: usa o valor do item do pedido correspondente ao modelo/armazenamento/grade
        SELECT oi.unit_price_usd INTO v_unit_price
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id AND oi.model = v_alloc.model AND oi.storage = v_alloc.storage AND oi.grade_id = v_alloc.grade_id
        LIMIT 1;

        IF v_unit_price IS NULL THEN
            -- Fallback: média simples do pedido caso não encontre item exato
            v_unit_price := CASE WHEN v_order.total_amount_usd > 0 AND (
                SELECT COUNT(*) FROM public.order_device_allocations WHERE order_id = p_order_id
            ) > 0 THEN v_order.total_amount_usd / (SELECT COUNT(*) FROM public.order_device_allocations WHERE order_id = p_order_id) ELSE 0 END;
        END IF;

        INSERT INTO public.sale_return_items (return_id, order_id, device_id, imei, model, storage, original_sale_price_usd)
        VALUES (v_return_id, p_order_id, v_device_id, v_alloc.imei, v_alloc.model, v_alloc.storage, v_unit_price);

        UPDATE public.order_device_allocations
        SET status = 'Devolvido'
        WHERE order_id = p_order_id AND device_id = v_device_id;

        UPDATE public.devices
        SET status = 'Disponível', updated_at = NOW()
        WHERE id = v_device_id;

        INSERT INTO public.stock_movements (device_id, order_id, movement_type, previous_status, new_status, reason, notes)
        VALUES (v_device_id, p_order_id, 'Retorno', 'Vendido', 'Disponível', 'Devolução de Venda (Pedido ' || v_order.order_number || ')', 'Motivo: ' || p_reason || COALESCE(' — ' || p_notes, ''));

        v_total_returned_now := v_total_returned_now + v_unit_price;
        v_commission_returned_now := v_commission_returned_now + COALESCE(v_retailer.commission_per_unit_usd, 0);
    END LOOP;

    UPDATE public.sale_returns
    SET total_amount_usd = v_total_returned_now,
        total_commission_usd = v_commission_returned_now
    WHERE id = v_return_id;

    v_new_returned_amount := v_order.returned_amount_usd + v_total_returned_now;
    v_new_returned_commission := v_order.returned_commission_usd + v_commission_returned_now;
    v_net_total := GREATEST(0, v_order.total_amount_usd - v_new_returned_amount);
    v_new_balance_due := GREATEST(0, v_net_total - v_order.paid_amount_usd);
    v_new_credit_due := GREATEST(0, v_order.paid_amount_usd - v_net_total);

    -- Se o saldo pago excede o novo total líquido, reduz parcelas em aberto
    -- (da mais recente para a mais antiga) para não deixar Contas a Receber incorreto
    v_excess := 0;
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_open_sum FROM public.installments
    WHERE order_id = p_order_id AND status != 'Pago';

    IF v_open_sum > v_new_balance_due THEN
        v_excess := v_open_sum - v_new_balance_due;
        FOR v_open_installment IN
            SELECT * FROM public.installments
            WHERE order_id = p_order_id AND status != 'Pago'
            ORDER BY due_date DESC
        LOOP
            EXIT WHEN v_excess <= 0;
            v_reduction := LEAST(v_excess, v_open_installment.amount_usd);
            IF v_reduction >= v_open_installment.amount_usd THEN
                UPDATE public.installments SET status = 'Pago', amount_usd = 0, notes = COALESCE(notes, '') || ' [Cancelada por devolução]'
                WHERE id = v_open_installment.id;
            ELSE
                UPDATE public.installments SET amount_usd = amount_usd - v_reduction
                WHERE id = v_open_installment.id;
            END IF;
            v_excess := v_excess - v_reduction;
        END LOOP;
    END IF;

    -- Determina se a venda ficou totalmente devolvida
    SELECT COUNT(*) INTO v_total_allocated FROM public.order_device_allocations WHERE order_id = p_order_id;
    SELECT COUNT(*) INTO v_total_returned_after FROM public.order_device_allocations WHERE order_id = p_order_id AND status = 'Devolvido';

    v_new_status := CASE WHEN v_total_returned_after >= v_total_allocated THEN 'Totalmente Devolvida' ELSE 'Parcialmente Devolvida' END;

    UPDATE public.orders
    SET returned_amount_usd = v_new_returned_amount,
        returned_commission_usd = v_new_returned_commission,
        total_profit_usd = total_profit_usd - (v_total_returned_now - (
            SELECT COALESCE(SUM(d.cost_price_usd), 0) FROM public.devices d WHERE d.id = ANY(p_device_ids)
        )),
        balance_due_usd = v_new_balance_due,
        credit_due_usd = v_new_credit_due,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'return_id', v_return_id,
        'order_id', p_order_id,
        'order_status', v_new_status,
        'returned_amount_usd', v_total_returned_now,
        'returned_commission_usd', v_commission_returned_now,
        'net_total_usd', v_net_total,
        'balance_due_usd', v_new_balance_due,
        'credit_due_usd', v_new_credit_due
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_register_sale_return(UUID, UUID[], VARCHAR, TEXT, VARCHAR) TO authenticated, anon, service_role;
