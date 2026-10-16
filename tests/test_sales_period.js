// TESTE: faturamento e lucro por período do card "Faturamento & Vendas" (Dashboard)
import { summarizeSalesPeriod, getPeriodStart } from '../src/lib/salesPeriod.js';

let total = 0;
function assert(condition, message) {
  total++;
  if (!condition) { console.error(`❌ FALHA: ${message}`); process.exit(1); }
  console.log(`✅ APROVADO: ${message}`);
}

const DAY = 24 * 60 * 60 * 1000;
// "Agora" fixo: 15/10/2026 14:00 em São Paulo
const NOW = new Date('2026-10-15T14:00:00-03:00').getTime();
const ago = (ms) => new Date(NOW - ms).toISOString();
const sale = (id, finalizedAt, amount, profit, extra = {}) => ({
  id, status: 'Finalizado', finalized_at: finalizedAt, created_at: finalizedAt,
  total_amount_usd: amount, total_profit_usd: profit, returned_amount_usd: 0, ...extra
});

console.log('--- Teste 1: nenhuma venda em 7 dias ---');
const oldOnly = [sale('a', ago(60 * DAY), 5000, 400), sale('b', ago(20 * DAY), 1000, 100)];
let r = summarizeSalesPeriod(oldOnly, '7D', NOW);
assert(r.revenue === 0 && r.profit === 0, '7D sem vendas = faturamento 0 e lucro 0');
assert(r.points.length === 0, '7D sem vendas = gráfico vazio (sem curva fictícia)');

console.log('--- Teste 2: venda antiga fora do período ---');
r = summarizeSalesPeriod(oldOnly, '30D', NOW);
assert(r.revenue === 1000 && r.sales.length === 1, '30D inclui a venda de 20 dias e exclui a de 60 dias');
r = summarizeSalesPeriod(oldOnly, '1A', NOW);
assert(r.revenue === 6000, '1A inclui as duas');
r = summarizeSalesPeriod(oldOnly, 'ALL', NOW);
assert(r.revenue === 6000 && r.profit === 500, 'Tudo inclui todas as vendas válidas');

console.log('--- Teste 3: venda de hoje ---');
const today = sale('c', ago(2 * 60 * 60 * 1000), 8000, 1500);
r = summarizeSalesPeriod([...oldOnly, today], '24H', NOW);
assert(r.revenue === 8000 && r.profit === 1500, '24H mostra só a venda de hoje');
assert(r.points.length === 24, '24H tem 24 pontos (hora a hora)');

console.log('--- Teste 4: venda excluída / cancelada / não concluída ---');
const mixed = [
  today,
  sale('d', ago(DAY), 999, 99, { status: 'Cancelado' }),
  sale('e', ago(DAY), 777, 77, { status: 'Reservado' }),
  sale('f', ago(DAY), 555, 55, { status: 'Em Separação' })
];
r = summarizeSalesPeriod(mixed, '7D', NOW);
assert(r.revenue === 8000 && r.sales.length === 1, 'canceladas, reservas e separações não contam');
r = summarizeSalesPeriod(mixed.filter(o => o.id !== 'c'), '7D', NOW);
assert(r.revenue === 0, 'após excluir a venda, ela deixa de contar');

console.log('--- Devoluções ---');
r = summarizeSalesPeriod([sale('g', ago(DAY), 3000, 600, { status: 'Parcialmente Devolvida', returned_amount_usd: 1000 })], '7D', NOW);
assert(r.revenue === 2000, 'faturamento líquido do valor devolvido');

console.log('--- Data da venda = finalized_at (nunca created_at/updated_at) ---');
const reservedLongAgo = sale('h', ago(DAY), 1200, 200, { created_at: ago(90 * DAY), updated_at: ago(0) });
r = summarizeSalesPeriod([reservedLongAgo], '7D', NOW);
assert(r.revenue === 1200, 'pedido criado há 90 dias e concluído ontem entra em 7D');
const editedOldSale = sale('i', ago(90 * DAY), 1300, 300, { updated_at: ago(0) });
r = summarizeSalesPeriod([editedOldSale], '7D', NOW);
assert(r.revenue === 0, 'venda antiga editada hoje (updated_at) não entra em 7D');
const undated = sale('j', null, 400, 40);
assert(summarizeSalesPeriod([undated], '30D', NOW).revenue === 0, 'venda sem finalized_at não entra em período com data');
r = summarizeSalesPeriod([undated], 'ALL', NOW);
assert(r.revenue === 400 && r.undatedCount === 1, 'venda sem finalized_at entra em Tudo e é contada como sem data');

console.log('--- Teste 5: períodos distintos e limites em São Paulo ---');
const series = [
  sale('k', ago(3 * 60 * 60 * 1000), 100, 10),
  sale('l', ago(3 * DAY), 200, 20),
  sale('m', ago(15 * DAY), 300, 30),
  sale('n', ago(200 * DAY), 400, 40),
  sale('o', ago(500 * DAY), 500, 50)
];
const totals = ['24H', '7D', '30D', '1A', 'ALL'].map(f => summarizeSalesPeriod(series, f, NOW).revenue);
assert(JSON.stringify(totals) === JSON.stringify([100, 300, 600, 1000, 1500]), `cada período soma só o que lhe pertence (${totals.join(', ')})`);
assert(new Date(getPeriodStart('7D', NOW)).toISOString() === '2026-10-09T03:00:00.000Z', '7D começa à meia-noite de São Paulo de 6 dias atrás');
const justBefore = sale('p', new Date('2026-10-09T02:59:00Z').toISOString(), 50, 5);
const justAfter = sale('q', new Date('2026-10-09T03:00:00Z').toISOString(), 70, 7);
assert(summarizeSalesPeriod([justBefore, justAfter], '7D', NOW).revenue === 70, '23:59 do dia anterior (SP) fica fora; 00:00 entra');

console.log('--- Teste 7: gráfico fecha com o total ---');
for (const f of ['24H', '7D', '30D', '1A', 'ALL']) {
  const s = summarizeSalesPeriod(series, f, NOW);
  const sum = s.points.reduce((acc, p) => acc + p.value, 0);
  assert(sum === s.revenue && s.points.at(-1).cumulative === s.revenue, `${f}: soma dos pontos = último acumulado = faturamento`);
}
assert(summarizeSalesPeriod(series, '7D', NOW).points.length === 7, '7D tem 7 pontos diários');
assert(summarizeSalesPeriod(series, '30D', NOW).points.length === 30, '30D tem 30 pontos diários');

console.log(`\n🎉 ${total} verificações aprovadas`);
