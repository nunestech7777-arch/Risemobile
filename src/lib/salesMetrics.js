// RISEMOBILE: Métricas de Vendas Mensais por Período
// Regras para os 3 Cards do Módulo de Vendas (Controlphone)
// Fuso horário estrito: America/Sao_Paulo (UTC-3 fixo)

export const SALES_TIMEZONE = 'America/Sao_Paulo';

export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

export const MONTH_SHORT_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez'
];

// Obtém ano e mês no fuso America/Sao_Paulo
export const getSaoPauloDateParts = (date = new Date()) => {
  const spFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALES_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = spFmt.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
  return { year, month };
};

// Vendas válidas concluídas
export const REALIZED_SALES_STATUSES = ['Finalizado', 'Parcialmente Devolvida', 'Totalmente Devolvida'];

/**
 * Calcula as métricas mensais para os 3 cards do Módulo de Vendas:
 * 1. Aparelhos Vendidos (quantidade física de aparelhos, não pedidos, deduzidas devoluções)
 * 2. Faturamento Total (faturamento líquido de devoluções + juros da maquininha cobrados do cliente)
 * 3. Lucro Total (valor dos produtos vendidos - custos acumulados; juros da maquininha NÃO entram no lucro)
 */
export const calculateMonthlySalesMetrics = (orders = [], selectedYear, selectedMonth, exchangeRate = 5.48) => {
  const validOrders = orders.filter((o) => {
    if (!o) return false;
    const isValidStatus = REALIZED_SALES_STATUSES.includes(o.status);
    if (!isValidStatus) return false;

    // Filtrar estritamente pela data de conclusão no fuso America/Sao_Paulo
    const dateStr = o.finalized_at || o.created_at;
    if (!dateStr) return false;

    const saleDate = new Date(dateStr);
    if (isNaN(saleDate.getTime())) return false;

    const { year, month } = getSaoPauloDateParts(saleDate);
    return year === selectedYear && month === selectedMonth;
  });

  let deviceCount = 0;
  let totalRevenueUSD = 0;
  let totalProfitUSD = 0;

  // Valores já estão em R$: a cotação não é aplicada (parâmetro mantido por compatibilidade)

  validOrders.forEach((sale) => {
    // 1. Aparelhos Vendidos:
    // Conta aparelhos físicos ativos na venda (exclui aparelhos devolvidos).
    // Em vendas totalmente devolvidas, allocated_devices é vazio (0 aparelhos).
    const activeUnits = sale.allocated_devices
      ? sale.allocated_devices.length
      : (sale.items?.reduce((acc, i) => acc + (parseInt(i.quantity, 10) || 0), 0) || 0);

    deviceCount += activeUnits;

    // 2. Faturamento Total:
    // Faturamento bruto líquido de devoluções efetivadas + juros de maquininha cobrados do cliente
    const baseAmountUSD = parseFloat(sale.total_amount_usd) || 0;
    const returnedAmountUSD = parseFloat(sale.returned_amount_usd) || 0;
    const machineFeeUSD = parseFloat(
      sale.machine_fee_usd || sale.card_fee_usd || sale.card_interest_usd || 0
    );

    const netSaleRevenueUSD = (baseAmountUSD - returnedAmountUSD) + machineFeeUSD;
    totalRevenueUSD += netSaleRevenueUSD;

    // 3. Lucro Total:
    // Valor dos produtos vendidos - custos acumulados dos aparelhos
    // Os juros da maquininha NÃO entram no lucro dos aparelhos.
    let saleProfitUSD = 0;
    if (sale.total_profit_usd !== undefined && sale.total_profit_usd !== null) {
      saleProfitUSD = parseFloat(sale.total_profit_usd) || 0;
    } else {
      const productRevenueUSD = baseAmountUSD - returnedAmountUSD;
      const devicesCostUSD = sale.allocated_devices
        ? sale.allocated_devices.reduce((acc, d) => acc + (parseFloat(d.cost_price_usd) || 0), 0)
        : 0;
      saleProfitUSD = productRevenueUSD - devicesCostUSD;
    }

    totalProfitUSD += saleProfitUSD;
  });

  return {
    deviceCount,
    totalRevenueBRL: totalRevenueUSD,
    totalProfitBRL: totalProfitUSD,
    validSalesCount: validOrders.length
  };
};
