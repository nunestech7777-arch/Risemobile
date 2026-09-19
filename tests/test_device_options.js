// TESTE: opções de cadastro (cores e modelos) compartilhadas entre Estoque e Vendas
import fs from 'node:fs';
import { COLOR_OPTIONS, IPHONE_MODELS } from '../src/lib/deviceOptions.js';

let total = 0;
function assert(condition, message) {
  total++;
  if (!condition) { console.error(`❌ FALHA: ${message}`); process.exit(1); }
  console.log(`✅ APROVADO: ${message}`);
}

console.log('--- Cores ---');
assert(COLOR_OPTIONS.includes('Amarelo') && COLOR_OPTIONS.includes('Vermelho'), 'cores Amarelo e Vermelho existem');
assert(['Preto', 'Branco', 'Azul', 'Rosa', 'Verde', 'Titânio Natural'].every(c => COLOR_OPTIONS.includes(c)), 'cores anteriores continuam disponíveis');
assert(new Set(COLOR_OPTIONS).size === COLOR_OPTIONS.length, 'sem cores repetidas');

console.log('--- Modelos ---');
const NEW_MODELS = ['iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max', 'iPhone 18', 'iPhone 18 Pro', 'iPhone 18 Pro Max'];
assert(NEW_MODELS.every(m => IPHONE_MODELS.includes(m)), 'linhas 17 e 18 (normal, Pro e Pro Max) existem');
assert(['iPhone 13', 'iPhone 15 Pro Max', 'iPhone 16 Plus', 'iPhone 16 Pro Max'].every(m => IPHONE_MODELS.includes(m)), 'modelos anteriores continuam disponíveis');
assert(new Set(IPHONE_MODELS).size === IPHONE_MODELS.length, 'sem modelos repetidos');

console.log('--- Estoque e Vendas usam a mesma lista ---');
for (const file of ['src/components/stock/StockEntryModule.jsx', 'src/components/sales/SalesModule.jsx']) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert(/import \{[^}]*IPHONE_MODELS[^}]*\} from '\.\.\/\.\.\/lib\/deviceOptions'/.test(src), `${file} importa a lista compartilhada`);
  assert(!/const IPHONE_MODELS\s*=/.test(src), `${file} não mantém lista própria`);
}

console.log(`\n🎉 TODOS OS ${total} TESTES DE OPÇÕES DE CADASTRO FORAM APROVADOS! (${total}/${total})`);
