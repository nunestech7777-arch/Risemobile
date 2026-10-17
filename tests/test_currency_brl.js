// TESTE: sistema em R$ — banco em US$, tela/digitação/planilhas em R$ pela cotação do dia
import * as XLSX from 'xlsx';
import { setUsdToBrlRate, getUsdToBrlRate, usdToBrl, brlToUsd, formatMoney, toBrlAmount, formatUSD } from '../src/lib/formatters.js';
import { parseStockExcelFile } from '../src/lib/excelUtils.js';

let total = 0;
function assert(condition, message) {
  total++;
  if (!condition) { console.error(`❌ FALHA: ${message}`); process.exit(1); }
  console.log(`✅ APROVADO: ${message}`);
}
const norm = (s) => s.replace(/\s/g, ' ');

console.log('--- Conversão e formatação ---');
setUsdToBrlRate(5);
assert(getUsdToBrlRate() === 5, 'cotação aplicada');
assert(norm(formatMoney(1000)) === 'R$ 5.000,00', `US$ 1.000 aparece como R$ 5.000,00 (${norm(formatMoney(1000))})`);
assert(norm(formatMoney(0)) === 'R$ 0,00', 'zero em reais');
assert(usdToBrl(2) === 10 && brlToUsd(10) === 2, 'ida e volta US$ <-> R$');
assert(toBrlAmount(193.825) === 969.13, 'exportação arredonda a centavos');
assert(norm(formatUSD(3308.33)) === 'US$ 3.308,33', `referência em dólar no padrão brasileiro (${norm(formatUSD(3308.33))})`);

setUsdToBrlRate(0);
setUsdToBrlRate(-3);
setUsdToBrlRate('abc');
assert(getUsdToBrlRate() === 5, 'cotação inválida é ignorada (mantém a anterior)');

setUsdToBrlRate(5.5);
assert(norm(formatMoney(100)) === 'R$ 550,00', 'troca automática: nova cotação muda a exibição');

console.log('--- Planilha de importação ---');
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

setUsdToBrlRate(5);
let rows = await parseStockExcelFile(sheetFile([
  { 'Modelo': 'iPhone 15', 'Armazenamento': '128GB', 'Grade': 'A++', 'Custo Unitário R$ (opcional)': 2500, 'Preço Sugerido R$ (opcional)': '3.000,00' }
]));
assert(rows[0].cost_price_usd === 500, `modelo novo (R$ 2.500) grava US$ 500 (${rows[0].cost_price_usd})`);
assert(rows[0].suggested_price_usd === 600, `"3.000,00" em R$ vira US$ 600 (${rows[0].suggested_price_usd})`);

rows = await parseStockExcelFile(sheetFile([
  { 'Modelo': 'iPhone 15', 'Armazenamento': '128GB', 'Grade': 'A++', 'Custo Unitário USD (opcional)': 350, 'Preço Sugerido USD (opcional)': 430 }
]));
assert(rows[0].cost_price_usd === 350 && rows[0].suggested_price_usd === 430, 'planilha antiga (colunas USD) continua lida em dólar');

console.log(`\n🎉 ${total} verificações aprovadas`);
