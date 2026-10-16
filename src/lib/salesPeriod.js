// RISEMOBILE: faturamento e lucro realizados por período (card "Faturamento & Vendas" do Dashboard).
// Data da venda = orders.finalized_at (gravada uma única vez ao concluir a venda; nunca updated_at).
// Períodos no fuso America/Sao_Paulo (UTC-3 fixo: o Brasil não tem horário de verão desde 2019).

export const SALES_TIMEZONE = 'America/Sao_Paulo';
const SP_OFFSET = '-03:00';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Vendas concluídas (com devolução parcial/total o líquido já desconta o devolvido).
// Reservas, separações, rascunhos e canceladas não são faturamento; vendas excluídas não existem mais no banco.
export const REALIZED_ORDER_STATUSES = ['Finalizado', 'Parcialmente Devolvida', 'Totalmente Devolvida'];

export const isRealizedSale = (order) => Boolean(order) && REALIZED_ORDER_STATUSES.includes(order.status);

// Faturamento líquido de devoluções e lucro (venda − custo dos aparelhos, já ajustado nas devoluções).
export const getSaleRevenue = (order) => (Number(order.total_amount_usd) || 0) - (Number(order.returned_amount_usd) || 0);
export const getSaleProfit = (order) => Number(order.total_profit_usd) || 0;

export const getSaleDate = (order) => {
  const t = order?.finalized_at ? new Date(order.finalized_at).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
};

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: SALES_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (t) => dayKeyFmt.format(new Date(t)); // YYYY-MM-DD
const monthKey = (t) => dayKey(t).slice(0, 7); // YYYY-MM
const startOfSpDay = (t) => new Date(`${dayKey(t)}T00:00:00${SP_OFFSET}`).getTime();

const dayLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: SALES_TIMEZONE, day: '2-digit', month: '2-digit' });
const monthLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: SALES_TIMEZONE, month: 'short', year: '2-digit' });
const hourLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: SALES_TIMEZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Início do período (inclusive). 7D/30D = hoje + os 6/29 dias anteriores, a partir da meia-noite de São Paulo.
export const getPeriodStart = (filter, now = Date.now()) => {
  switch (filter) {
    case '24H': return now - DAY;
    case '7D': return startOfSpDay(now - 6 * DAY);
    case '30D': return startOfSpDay(now - 29 * DAY);
    case '1A': return startOfSpDay(now - 364 * DAY);
    default: return null; // Tudo
  }
};

// Faixas do gráfico: hora a hora (24H), dia a dia (7D/30D) ou mês a mês (1A/Tudo).
const buildBuckets = (filter, start, now) => {
  const buckets = [];
  if (filter === '24H') {
    for (let i = 0; i < 24; i++) {
      const from = start + i * HOUR;
      buckets.push({ key: String(i), from, label: hourLabel.format(new Date(from)) });
    }
    return { buckets, keyOf: (t) => String(Math.min(23, Math.floor((t - start) / HOUR))) };
  }
  if (filter === '7D' || filter === '30D') {
    for (let t = start; t <= now; t += DAY) {
      buckets.push({ key: dayKey(t), from: t, label: dayLabel.format(new Date(t)) });
    }
    return { buckets, keyOf: dayKey };
  }
  // Mensal: do mês de início até o mês atual
  let [year, month] = monthKey(start).split('-').map(Number);
  const last = monthKey(now);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const from = new Date(`${key}-01T00:00:00${SP_OFFSET}`).getTime();
    buckets.push({ key, from, label: monthLabel.format(new Date(from)) });
    if (key >= last) break;
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return { buckets, keyOf: monthKey };
};

// Resumo do período: vendas consideradas, totais e série acumulada do gráfico
// (o último ponto é sempre o faturamento total do período).
export const summarizeSalesPeriod = (orders = [], filter = '7D', now = Date.now()) => {
  const start = getPeriodStart(filter, now);
  const realized = orders.filter(isRealizedSale);

  // Sem finalized_at não há data de venda confiável: entra apenas em "Tudo".
  const undated = realized.filter(o => getSaleDate(o) === null);
  const sales = realized.filter(o => {
    const t = getSaleDate(o);
    if (t === null) return start === null;
    return (start === null || t >= start) && t <= now;
  });

  const revenue = sales.reduce((sum, o) => sum + getSaleRevenue(o), 0);
  const profit = sales.reduce((sum, o) => sum + getSaleProfit(o), 0);

  if (sales.length === 0) {
    return { sales, revenue: 0, profit: 0, points: [], undatedCount: undated.length };
  }

  const dated = sales.map(getSaleDate).filter(t => t !== null);
  const seriesStart = start ?? (dated.length ? Math.min(...dated) : now);
  const { buckets, keyOf } = buildBuckets(filter, seriesStart, now);
  const byKey = new Map(buckets.map(b => [b.key, 0]));

  for (const o of sales) {
    const t = getSaleDate(o);
    // Vendas antigas sem data ("Tudo"): somam no primeiro ponto para o acumulado fechar com o total
    const key = t === null ? buckets[0].key : keyOf(t);
    byKey.set(key, (byKey.get(key) || 0) + getSaleRevenue(o));
  }

  let running = 0;
  const points = buckets.map(b => {
    const value = byKey.get(b.key) || 0;
    running += value;
    return { label: b.label, value, cumulative: running };
  });

  return { sales, revenue, profit, points, undatedCount: undated.length };
};
