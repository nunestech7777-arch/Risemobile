// TESTE: Exclusão de Venda com Restauração Automática de Estoque
import { DataService, initStorageIfNeeded } from '../src/lib/supabaseClient.js';

let passedCount = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FALHA: ${message}`);
    throw new Error(message);
  }
  passedCount++;
  console.log(`✅ APROVADO: ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('🔍 TESTE — EXCLUSÃO DE VENDA');
  console.log('================================================================');

  initStorageIfNeeded();
  const grades = await DataService.getGrades();
  const retailer = await DataService.saveRetailer({ store_name: 'Loja Teste Exclusão', commission_per_unit_usd: 1 });

  // ---- CENÁRIO 1: excluir uma venda Finalizada com 1 devolução parcial ----
  await DataService.createStockEntryBatch({
    reference_code: 'LOTE-DEL-001', model: 'iPhone 13', storage: '128GB', grade_id: grades[0].id,
    unit_cost_usd: '350.00', suggested_price_usd: '430.00', quantity: 2, notes: ''
  }, [
    { imei: '700000000000001', color: 'Preto', battery_health: 95, cost_price_usd: '350.00', suggested_price_usd: '430.00' },
    { imei: '700000000000002', color: 'Preto', battery_health: 94, cost_price_usd: '350.00', suggested_price_usd: '430.00' }
  ], 'teste');

  const order1 = await DataService.reserveOrder(
    { retailer_id: retailer.id, notes: '' },
    [{ model: 'iPhone 13', storage: '128GB', grade_id: grades[0].id, quantity: 2, unit_price_usd: '430.00' }]
  );
  await DataService.finalizeOrderSale(order1.id, [{ amount_usd: '860.00', method: 'PIX', exchange_rate: 5.14 }], []);

  let orders = await DataService.getOrders();
  let finalized = orders.find(o => o.id === order1.id);
  await DataService.registerSaleReturn(order1.id, [finalized.allocated_devices[0].device_id], 'Defeito', '', 'teste');

  await DataService.deleteOrder(order1.id);

  orders = await DataService.getOrders();
  assert(!orders.some(o => o.id === order1.id), 'A venda foi removida da lista de pedidos');

  const devicesAfter1 = await DataService.getDevices();
  const d1 = devicesAfter1.find(d => d.imei === '700000000000001');
  const d2 = devicesAfter1.find(d => d.imei === '700000000000002');
  assert(Boolean(d1) && Boolean(d2), 'Os aparelhos continuam existindo no banco (não foram apagados)');
  assert(d1.status === 'Disponível' && d2.status === 'Disponível', 'Ambos os aparelhos voltaram para Disponível (o vendido restaurado + o já devolvido)');

  const installmentsAfter1 = await DataService.getInstallments();
  assert(!installmentsAfter1.some(i => i.order_id === order1.id), 'Parcelas vinculadas à venda excluída também foram removidas');

  // ---- CENÁRIO 2: excluir uma venda ainda Reservada (nunca finalizada) ----
  await DataService.createStockEntryBatch({
    reference_code: 'LOTE-DEL-002', model: 'iPhone 14', storage: '256GB', grade_id: grades[0].id,
    unit_cost_usd: '400.00', suggested_price_usd: '500.00', quantity: 1, notes: ''
  }, [
    { imei: '700000000000003', color: 'Azul', battery_health: 90, cost_price_usd: '400.00', suggested_price_usd: '500.00' }
  ], 'teste');

  const order2 = await DataService.reserveOrder(
    { retailer_id: retailer.id, notes: '' },
    [{ model: 'iPhone 14', storage: '256GB', grade_id: grades[0].id, quantity: 1, unit_price_usd: '500.00' }]
  );

  const devicesBeforeDelete2 = await DataService.getDevices();
  const reservedDevice = devicesBeforeDelete2.find(d => d.imei === '700000000000003');
  assert(reservedDevice.status === 'Reservado', 'Aparelho está Reservado antes da exclusão');

  await DataService.deleteOrder(order2.id);

  const ordersAfter2 = await DataService.getOrders();
  assert(!ordersAfter2.some(o => o.id === order2.id), 'A venda reservada foi removida');

  const devicesAfter2 = await DataService.getDevices();
  const restoredDevice = devicesAfter2.find(d => d.imei === '700000000000003');
  assert(restoredDevice.status === 'Disponível', 'Aparelho reservado voltou automaticamente para Disponível ao excluir a venda');

  console.log('================================================================');
  console.log(`🎉 TODOS OS ${totalTests} TESTES DE EXCLUSÃO DE VENDA FORAM APROVADOS! (${passedCount}/${totalTests})`);
  console.log('================================================================');
}

run().catch(err => {
  console.error('💥 ERRO NA AUDITORIA:', err.message);
  console.log(`\nResultado parcial: ${passedCount}/${totalTests} testes aprovados antes da falha.`);
  process.exit(1);
});
