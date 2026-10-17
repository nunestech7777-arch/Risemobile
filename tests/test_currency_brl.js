// TESTE: moeda do sistema = BRL, sem conversão cambial (a cotação do dólar é só informativa)
import * as XLSX from 'xlsx';
import { formatMoney, toBrlAmount } from '../src/lib/formatters.js';
import { parseStockExcelFile } from '../src/lib/excelUtils.js';
import { calculateMonthlySalesMetrics } from '../src/lib/salesMetrics.js';

let total = 0;
function assert(condition, message) {
  total++;
  if (!condition) { console.error(`❌ FALHA: ${message}`); process.exit(1); }
  console.log(`✅ APROVADO: ${message}`);
}
const norm = (s) => s.replace(/\s/g, ' ');

console.log('--- Teste 1: aparelho antigo cadastrado por R$ 2.500,00 ---');
assert(norm(formatMoney(2500)) === 'R$ 2.500,00', `exibe R$ 2.500,00 (${norm(formatMoney(2500))})`);
assert(norm(formatMoney(13922.43)) === 'R$ 13.922,43', 'valor gravado aparece exatamente igual, sem multiplicar');
assert(toBrlAmount(2500.004) === 2500, 'exportação em R$ sem cotação');

console.log('--- Teste 2: alterar a cotação não muda valores ---');
const orders = [{
  status: 'Finalizado', finalized_at: '2026-10-10T15:00:00-03:00',
  total_amount_usd: 8000, returned_amount_usd: 0, total_profit_usd: 1500, allocated_devices: [{}]
}];
const m1 = calculateMonthlySalesMetrics(orders, 2026, 10, 5.0);
const m2 = calculateMonthlySalesMetrics(orders, 2026, 10, 6.2);
assert(m1.totalRevenueBRL === 8000 && m1.totalProfitBRL === 1500, 'métricas de vendas não multiplicam pela cotação');
assert(m1.totalRevenueBRL === m2.totalRevenueBRL, 'cotação diferente, mesmo faturamento');

console.log('--- Planilha de importação: valores gravados como digitados ---');
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buf => this.onload({ target: { result: buf } }));
  }
};
const sheetFile = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Estoque');
  return new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]);
};
let rows = await parseStockExcelFile(sheetFile([
  { 'Modelo': 'iPhone 15', 'Armazenamento': '128GB', 'Grade': 'A++', 'Custo Unitário R$ (opcional)': 2500, 'Preço Sugerido R$ (opcional)': '3.000,00' }
]));
assert(rows[0].cost_price_usd === 2500 && rows[0].suggested_price_usd === 3000, 'modelo em R$: 2500 e "3.000,00" gravados como 2500 e 3000');
rows = await parseStockExcelFile(sheetFile([
  { 'Modelo': 'iPhone 15', 'Armazenamento': '128GB', 'Grade': 'A++', 'Custo Unitário USD (opcional)': 2000, 'Preço Sugerido USD (opcional)': 2600 }
]));
assert(rows[0].cost_price_usd === 2000 && rows[0].suggested_price_usd === 2600, 'planilha antiga (cabeçalho "USD") também é lida sem conversão');

console.log(`\n🎉 ${total} verificações aprovadas`);
