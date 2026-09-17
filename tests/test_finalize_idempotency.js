// TESTE: Idempotência da Finalização de Venda
// Garante que o mesmo pedido não pode ser finalizado (baixa de estoque,
// pagamento, comissão e faturamento) mais de uma vez.
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
  console.log('🔍 TESTE DE IDEMPOTÊNCIA — DUPLA FINALIZAÇÃO DE VENDA');
  console.log('================================================================');

  initStorageIfNeeded();

  const grades = await DataService.getGrades();

  await DataService.createStockEntryBatch({
    reference_code: 'LOTE-IDEMP-001',
    model: 'iPhone 15',
    storage: '128GB',
    grade_id: grades[0].id,
    unit_cost_usd: '400.00',
    suggested_price_usd: '480.00',
    quantity: 2,
    notes: ''
  }, [
    { imei: '900000000000001', color: 'Preto', battery_health: 99, cost_price_usd: '400.00', suggested_price_usd: '480.00' },
    { imei: '900000000000002', color: 'Preto', battery_health: 97, cost_price_usd: '400.00', suggested_price_usd: '480.00' }
  ], 'teste');

  const retailers = await DataService.getRetailers();
  let retailer = retailers[0];
  if (!retailer) {
    retailer = await DataService.saveRetailer({ store_name: 'Loja Teste Idempotência', commission_per_unit_usd: 5 });
  }

  const order = await DataService.reserveOrder(
    { retailer_id: retailer.id, notes: 'Pedido de teste de idempotência' },
    [{ model: 'iPhone 15', storage: '128GB', grade_id: grades[0].id, quantity: 2, unit_price_usd: '430.00' }]
  );

  assert(order.status === 'Reservado', 'Pedido criado com status Reservado');

  const firstResult = await DataService.finalizeOrderSale(
    order.id,
    [{ amount_usd: '860.00', method: 'PIX', exchange_rate: 5.14 }],
    []
  );
  assert(firstResult.success === true, 'Primeira finalização executada com sucesso');

  const orders = await DataService.getOrders();
  const finalizedOrder = orders.find(o => o.id === order.id);
  assert(finalizedOrder.status === 'Finalizado', 'Pedido está com status Finalizado após a primeira finalização');

  let blocked = false;
  let errorMessage = '';
  try {
    await DataService.finalizeOrderSale(
      order.id,
      [{ amount_usd: '860.00', method: 'PIX', exchange_rate: 5.14 }],
      []
    );
  } catch (err) {
    blocked = true;
    errorMessage = err.message;
  }

  assert(blocked, 'Segunda tentativa de finalização do mesmo pedido foi BLOQUEADA');
  console.log(`   Mensagem capturada: "${errorMessage}"`);

  const ordersAfter = await DataService.getOrders();
  const orderAfter = ordersAfter.find(o => o.id === order.id);
  assert(orderAfter.paid_amount_usd === 860, 'paid_amount_usd não foi duplicado após a tentativa bloqueada');

  const devices = await DataService.getDevices();
  const soldDevices = devices.filter(d => d.imei === '900000000000001' || d.imei === '900000000000002');
  assert(soldDevices.every(d => d.status === 'Vendido'), 'Os 2 aparelhos permanecem Vendido (sem efeito colateral da tentativa bloqueada)');

  // ---- Depois de uma devolução parcial, também não pode "re-finalizar" ----
  const deviceToReturn = finalizedOrder.allocated_devices[0];
  await DataService.registerSaleReturn(order.id, [deviceToReturn.device_id], 'Defeito', '', 'teste');

  const ordersAfterReturn = await DataService.getOrders();
  const partiallyReturnedOrder = ordersAfterReturn.find(o => o.id === order.id);
  assert(partiallyReturnedOrder.status === 'Parcialmente Devolvida', 'Pedido está Parcialmente Devolvida após a devolução');

  let blockedAfterReturn = false;
  try {
    await DataService.finalizeOrderSale(order.id, [{ amount_usd: '860.00', method: 'PIX', exchange_rate: 5.14 }], []);
  } catch (err) {
    blockedAfterReturn = true;
  }
  assert(blockedAfterReturn, 'Finalizar novamente um pedido já Parcialmente Devolvida foi BLOQUEADO');

  const ordersFinalCheck = await DataService.getOrders();
  const orderFinalCheck = ordersFinalCheck.find(o => o.id === order.id);
  assert(orderFinalCheck.status === 'Parcialmente Devolvida', 'Status continua Parcialmente Devolvida (não foi sobrescrito de volta para Finalizado)');
  assert(orderFinalCheck.returned_amount_usd > 0, 'returned_amount_usd continua preservado após a tentativa bloqueada');

  console.log('================================================================');
  console.log(`🎉 TODOS OS ${totalTests} TESTES DE IDEMPOTÊNCIA FORAM APROVADOS! (${passedCount}/${totalTests})`);
  console.log('================================================================');
}

run().catch(err => {
  console.error('💥 ERRO NA AUDITORIA:', err.message);
  console.log(`\nResultado parcial: ${passedCount}/${totalTests} testes aprovados antes da falha.`);
  process.exit(1);
});
