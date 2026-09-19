// TESTE: escolher a COR do aparelho na venda (regras compartilhadas + motor local do DataService)
import { DataService, initStorageIfNeeded } from '../src/lib/supabaseClient.js';
import { allocateDevicesForItems, findColorMismatch, findOrderItemForDevice, getAvailableColors, getRemainingForItem } from '../src/lib/saleAllocation.js';

let passed = 0;
let total = 0;
function assert(condition, message) {
  total++;
  if (!condition) { console.error(`❌ FALHA: ${message}`); throw new Error(message); }
  passed++;
  console.log(`✅ APROVADO: ${message}`);
}
async function rejects(fn, pattern, message) {
  let error = null;
  try { await fn(); } catch (e) { error = e; }
  assert(error && pattern.test(error.message), `${message} (${error ? error.message.slice(0, 80) : 'não lançou erro'})`);
}

const dev = (id, color, battery, extra = {}) => ({
  id, model: 'iPhone 17', storage: '256GB', grade_id: 'g1', color, battery_health: battery, status: 'Disponível', ...extra
});
const cfg = { model: 'iPhone 17', storage: '256GB', grade_id: 'g1' };

async function run() {
  console.log('================================================================');
  console.log('🎨 TESTE — COR DO APARELHO NA VENDA');
  console.log('================================================================');

  console.log('\n--- Cores disponíveis para o seletor ---');
  const stock = [dev('a', 'Branco', 90), dev('b', 'branco ', 95), dev('c', 'Preto', 80), dev('d', null, 99), dev('e', 'Amarelo', 70, { status: 'Reservado' }), dev('f', 'Vermelho', 60, { model: 'iPhone 16' })];
  const colors = getAvailableColors(stock, cfg);
  assert(colors.length === 2 && colors[0].color === 'Branco' && colors[0].count === 2 && colors[1].color === 'Preto' && colors[1].count === 1,
    'lista só cores em estoque Disponível da configuração, agrupando Branco/branco e com contagem');
  assert(!colors.some(c => c.color === 'Amarelo'), 'cor Reservada não aparece');
  assert(!colors.some(c => c.color === 'Vermelho'), 'cor de outro modelo não aparece');

  console.log('\n--- Quantidade restante por cor ---');
  assert(getRemainingForItem(stock, [], { ...cfg, color: '' }) === 4, 'qualquer cor: 4 disponíveis (inclui o sem cor)');
  assert(getRemainingForItem(stock, [], { ...cfg, color: 'Branco' }) === 2, 'cor Branco: 2 disponíveis');
  assert(getRemainingForItem(stock, [], { ...cfg, color: 'BRANCO' }) === 2, 'cor sem diferenciar maiúsculas');
  assert(getRemainingForItem(stock, [], { ...cfg, color: 'Amarelo' }) === 0, 'cor sem estoque: 0');
  const cart = [{ ...cfg, color: 'Branco', quantity: 1 }];
  assert(getRemainingForItem(stock, cart, { ...cfg, color: 'Branco' }) === 1, 'já no carrinho: 1 Branco restante');
  assert(getRemainingForItem(stock, cart, { ...cfg, color: '' }) === 3, 'qualquer cor desconta o que o carrinho já usa');
  const cartAny = [{ ...cfg, color: '', quantity: 3 }];
  assert(getRemainingForItem(stock, cartAny, { ...cfg, color: 'Preto' }) === 1, 'Preto ainda cabe, pois 3 de qualquer cor deixam 1 livre');
  const cartAny4 = [{ ...cfg, color: '', quantity: 4 }];
  assert(getRemainingForItem(stock, cartAny4, { ...cfg, color: 'Preto' }) === 0, 'com 4 de qualquer cor não sobra nada para uma cor específica');

  console.log('\n--- Seleção: cor pedida, bateria e prioridade ---');
  const pool = [dev('w1', 'Branco', 100), dev('w2', 'Branco', 100), dev('w3', 'Branco', 100), dev('p1', 'Preto', 80), dev('p2', 'Preto', 80)];
  let r = allocateDevicesForItems(pool, [{ ...cfg, color: 'Preto', quantity: 2 }]);
  assert(r.shortages.length === 0 && r.allocations[0].every(d => d.color === 'Preto'), 'item Preto recebe só aparelhos Pretos');
  r = allocateDevicesForItems(pool, [{ ...cfg, color: '', quantity: 4 }, { ...cfg, color: 'Branco', quantity: 1 }]);
  assert(r.shortages.length === 0 && r.allocations[1].length === 1 && r.allocations[1][0].color === 'Branco' && r.allocations[0].length === 4,
    '"qualquer cor" listado antes não consome o Branco pedido depois');
  const ids = r.allocations.flat().map(d => d.id);
  assert(new Set(ids).size === ids.length, 'nenhum aparelho é escolhido duas vezes');
  r = allocateDevicesForItems(pool, [{ ...cfg, color: 'Preto', quantity: 3 }]);
  assert(r.shortages.length === 1 && r.shortages[0].available === 2 && r.shortages[0].requested === 3, 'falta de estoque na cor é reportada (2 de 3)');
  r = allocateDevicesForItems([dev('x', null, 50), dev('y', null, 60)], [{ ...cfg, color: 'Preto', quantity: 1 }]);
  assert(r.shortages.length === 1, 'aparelho sem cor não atende cor específica');
  r = allocateDevicesForItems([dev('x', null, 50), dev('y', null, 60)], [{ ...cfg, quantity: 2 }]);
  assert(r.shortages.length === 0, 'aparelho sem cor atende "qualquer cor"');

  console.log('\n--- Preço na devolução por linha de cor ---');
  const items = [
    { model: 'iPhone 17', storage: '256GB', grade_id: 'g1', color: 'Branco', unit_price_usd: 440 },
    { model: 'iPhone 17', storage: '256GB', grade_id: 'g1', color: 'Preto', unit_price_usd: 470 }
  ];
  assert(findOrderItemForDevice(items, dev('z', 'preto', 1)).unit_price_usd === 470, 'aparelho Preto casa com a linha Preto');
  assert(findOrderItemForDevice(items, dev('z', 'Branco', 1)).unit_price_usd === 440, 'aparelho Branco casa com a linha Branco');
  const mixed = [{ ...items[0], color: null, unit_price_usd: 430 }, items[1]];
  assert(findOrderItemForDevice(mixed, dev('z', 'Verde', 1)).unit_price_usd === 430, 'cor sem linha própria usa a linha "qualquer cor"');
  assert(findOrderItemForDevice([{ ...items[0], color: undefined }], dev('z', 'Rosa', 1)).unit_price_usd === 440, 'pedidos antigos (sem coluna de cor) continuam casando');

  console.log('\n--- Proteção contra função antiga do banco ---');
  const wanted = [{ model: 'iPhone 17', storage: '256GB', color: 'Preto', quantity: 2 }];
  assert(findColorMismatch(wanted, [dev('a', 'Preto', 1), dev('b', 'Preto', 1)]) === null, 'devolução com as cores certas passa');
  assert(/iPhone 17 256GB Preto/.test(findColorMismatch(wanted, [dev('a', 'Preto', 1), dev('b', 'Branco', 1)])), 'devolução com cor errada é detectada');
  assert(findColorMismatch([{ model: 'iPhone 17', storage: '256GB', quantity: 2 }], [dev('a', 'Branco', 1)]) === null, 'item sem cor nunca é considerado erro');

  console.log('\n--- Motor local: reserva por cor ---');
  initStorageIfNeeded();
  DataService.clearAllOperationalData();
  const [grade] = await DataService.getGrades();
  const retailer = await DataService.saveRetailer({ store_name: 'Loja Cor', contact_name: 'T', whatsapp: '5511999990000', commission_per_unit_usd: 5 });
  await DataService.createStockEntryBatchMulti({ reference_code: 'L-COR', notes: '' }, [{
    model: 'iPhone 17 Pro', storage: '256GB', grade_id: grade.id,
    units: [
      { color: 'Amarelo', battery_health: 90 }, { color: 'Amarelo', battery_health: 95 },
      { color: 'Vermelho', battery_health: 99 }, { color: 'Vermelho', battery_health: 98 }, { color: 'Vermelho', battery_health: 97 }, {}
    ]
  }]);
  const item = (quantity, extra = {}) => ({ model: 'iPhone 17 Pro', storage: '256GB', grade_id: grade.id, quantity, unit_price_usd: 500, ...extra });

  const order1 = await DataService.reserveOrder({ retailer_id: retailer.id }, [item(2, { color: 'Amarelo' })]);
  assert(order1.allocated_devices.length === 2 && order1.allocated_devices.every(d => d.color === 'Amarelo'), 'pedido de 2 Amarelos reserva 2 Amarelos');
  assert(order1.items[0].color === 'Amarelo', 'a cor pedida fica gravada no item do pedido');
  const after1 = await DataService.getDevices();
  assert(after1.filter(d => d.color === 'Amarelo' && d.status === 'Reservado').length === 2, 'os 2 Amarelos ficaram Reservados');
  assert(after1.filter(d => d.color === 'Vermelho' && d.status === 'Disponível').length === 3, 'os 3 Vermelhos seguem Disponíveis');

  await rejects(() => DataService.reserveOrder({ retailer_id: retailer.id }, [item(1, { color: 'Amarelo' })]), /Estoque insuficiente.*Amarelo/, 'Amarelo esgotado é recusado citando a cor');
  const statusBefore = (await DataService.getDevices()).map(d => d.status).join();
  await rejects(() => DataService.reserveOrder({ retailer_id: retailer.id }, [item(2, { color: 'Vermelho' }), item(2, { color: 'Vermelho' })]), /Estoque insuficiente/, 'pedido maior que a cor disponível (4 de 3) é recusado');
  assert((await DataService.getDevices()).map(d => d.status).join() === statusBefore, 'recusa não deixa aparelhos reservados pela metade');

  const order2 = await DataService.reserveOrder({ retailer_id: retailer.id }, [item(1), item(1, { color: 'Vermelho' })]);
  assert(order2.allocated_devices.length === 2, 'pedido misto (qualquer cor + Vermelho) reserva 2 aparelhos');
  assert(order2.allocated_devices.filter(d => d.color === 'Vermelho').length >= 1, 'inclui o Vermelho pedido');

  console.log('\n--- Motor local: devolução usa o preço da cor ---');
  const order3 = await DataService.reserveOrder({ retailer_id: retailer.id }, [item(1, { color: 'Vermelho', unit_price_usd: 510 })]);
  await DataService.finalizeOrderSale(order3.id, [{ amount_usd: 510, method: 'PIX' }], []);
  const sold = order3.allocated_devices[0];
  const returned = await DataService.registerSaleReturn(order3.id, [sold.device_id], 'Defeito', '', 'admin');
  const returnedPrice = returned.returned_amount_usd;
  assert(Number(returnedPrice) === 510, `devolução credita o preço da linha (510) — recebido ${returnedPrice}`);

  console.log('\n================================================================');
  console.log(`🎉 TODOS OS ${total} TESTES DE COR NA VENDA FORAM APROVADOS! (${passed}/${total})`);
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\n💥 TESTE FALHOU:', err.message);
  process.exit(1);
});
