// TESTE: Devolução de Aparelhos em Vendas Finalizadas
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
  console.log('🔍 TESTE — DEVOLUÇÃO DE APARELHOS EM VENDA FINALIZADA');
  console.log('================================================================');

  initStorageIfNeeded();
  const grades = await DataService.getGrades();

  // Lote: 3x iPhone 13 a US$440 cada
  await DataService.createStockEntryBatch({
    reference_code: 'LOTE-RETURN-001',
    model: 'iPhone 13',
    storage: '128GB',
    grade_id: grades[0].id,
    unit_cost_usd: '360.00',
    suggested_price_usd: '440.00',
    quantity: 3,
    notes: ''
  }, [
    { imei: '111111111111111', color: 'Preto', battery_health: 98, cost_price_usd: '360.00', suggested_price_usd: '440.00' },
    { imei: '222222222222222', color: 'Preto', battery_health: 97, cost_price_usd: '360.00', suggested_price_usd: '440.00' },
    { imei: '333333333333333', color: 'Preto', battery_health: 96, cost_price_usd: '360.00', suggested_price_usd: '440.00' }
  ], 'teste');

  const retailer = await DataService.saveRetailer({
    store_name: 'Tech Apple Express RJ',
    commission_per_unit_usd: 1
  });

  const order = await DataService.reserveOrder(
    { retailer_id: retailer.id, notes: 'Pedido de teste de devolução' },
    [{ model: 'iPhone 13', storage: '128GB', grade_id: grades[0].id, quantity: 3, unit_price_usd: '440.00' }]
  );

  const result = await DataService.finalizeOrderSale(
    order.id,
    [{ amount_usd: '1320.00', method: 'PIX', exchange_rate: 5.14 }],
    []
  );
  assert(result.success, 'Venda de 3 aparelhos finalizada (US$ 1.320 total, comissão US$ 3)');

  let orders = await DataService.getOrders();
  let finalized = orders.find(o => o.id === order.id);
  assert(finalized.status === 'Finalizado', 'Pedido está Finalizado antes da devolução');
  assert(finalized.total_commission_usd === 3, 'Comissão inicial é US$ 3 (3 peças x US$1)');

  const deviceToReturn = finalized.allocated_devices.find(d => d.imei === '222222222222222');
  assert(Boolean(deviceToReturn), 'Aparelho IMEI 222222222222222 está entre os alocados do pedido');

  // ---- DEVOLUÇÃO PARCIAL: 1 de 3 ----
  const returnResult = await DataService.registerSaleReturn(
    order.id,
    [deviceToReturn.device_id],
    'Troca solicitada',
    'Cliente pediu troca por outro aparelho da mesma configuração',
    'teste@risemobile.com'
  );
  assert(returnResult.success, 'Devolução de 1 aparelho registrada com sucesso');
  assert(returnResult.order_status === 'Parcialmente Devolvida', 'Status retornado é Parcialmente Devolvida');

  orders = await DataService.getOrders();
  const afterReturn = orders.find(o => o.id === order.id);

  assert(afterReturn.status === 'Parcialmente Devolvida', 'Pedido está Parcialmente Devolvida (não Cancelada)');
  assert(afterReturn.allocated_devices.length === 2, 'Restam exatamente 2 aparelhos ativos na venda');
  assert(afterReturn.returned_devices.length === 1, 'Exatamente 1 aparelho está na lista de devolvidos');
  assert(afterReturn.allocated_devices.every(d => d.imei !== '222222222222222'), 'O IMEI devolvido não aparece mais como ativo');

  const devices = await DataService.getDevices();
  const returnedDevice = devices.find(d => d.imei === '222222222222222');
  const otherDevice1 = devices.find(d => d.imei === '111111111111111');
  const otherDevice2 = devices.find(d => d.imei === '333333333333333');
  assert(returnedDevice.status === 'Disponível', 'Aparelho devolvido voltou ao estoque como Disponível');
  assert(otherDevice1.status === 'Vendido' && otherDevice2.status === 'Vendido', 'Os outros 2 aparelhos continuam Vendido');

  assert(afterReturn.returned_amount_usd === 440, 'returned_amount_usd = US$ 440 (1 peça)');
  assert(afterReturn.total_amount_usd === 1320, 'total_amount_usd (bruto histórico) permanece US$ 1.320');
  const netRevenue = afterReturn.total_amount_usd - afterReturn.returned_amount_usd;
  assert(netRevenue === 880, 'Faturamento líquido = US$ 1.320 - US$ 440 = US$ 880');

  assert(afterReturn.returned_commission_usd === 1, 'returned_commission_usd = US$ 1 (1 peça x taxa)');
  const netCommission = afterReturn.total_commission_usd - afterReturn.returned_commission_usd;
  assert(netCommission === 2, 'Comissão válida final = US$ 3 - US$ 1 = US$ 2');

  assert(afterReturn.total_profit_usd === (result.total_profit_usd - 80), 'Lucro líquido reduzido em US$ 80 (margem do aparelho devolvido: 440 - 360)');

  const movements = await DataService.getMovements();
  const returnMovement = movements.find(m => m.order_id === order.id && m.movement_type === 'Retorno');
  assert(Boolean(returnMovement), 'Movimentação de estoque tipo Retorno foi registrada');
  assert(returnMovement.previous_status === 'Vendido' && returnMovement.new_status === 'Disponível', 'Movimentação registra Vendido → Disponível');

  assert(afterReturn.returns.length === 1, 'Histórico de devoluções do pedido contém 1 registro');
  assert(afterReturn.returns[0].reason === 'Troca solicitada', 'Motivo da devolução foi registrado corretamente');
  assert(afterReturn.returns[0].items[0].imei === '222222222222222', 'Item da devolução referencia o IMEI correto');

  // ---- BLOQUEIOS ----
  let blockedDouble = false;
  try {
    await DataService.registerSaleReturn(order.id, [deviceToReturn.device_id], 'Defeito', '', 'teste');
  } catch (err) {
    blockedDouble = true;
  }
  assert(blockedDouble, 'Mesmo aparelho não pode ser devolvido duas vezes');

  let blockedForeign = false;
  try {
    // Aparelho que nunca pertenceu a este pedido (ex: um dos outros ainda vendidos em outro pedido fictício)
    await DataService.registerSaleReturn(order.id, ['device-inexistente-xyz'], 'Defeito', '', 'teste');
  } catch (err) {
    blockedForeign = true;
  }
  assert(blockedForeign, 'Aparelho que não pertence ao pedido é rejeitado');

  // ---- DEVOLUÇÃO TOTAL: devolve os 2 restantes ----
  const remainingIds = afterReturn.allocated_devices.map(d => d.device_id);
  const finalReturnResult = await DataService.registerSaleReturn(order.id, remainingIds, 'Defeito', 'Ambos com defeito de tela', 'teste');
  assert(finalReturnResult.order_status === 'Totalmente Devolvida', 'Devolver os aparelhos restantes marca a venda como Totalmente Devolvida');

  orders = await DataService.getOrders();
  const fullyReturned = orders.find(o => o.id === order.id);
  assert(fullyReturned.allocated_devices.length === 0, 'Nenhum aparelho ativo resta na venda');
  assert(fullyReturned.returned_devices.length === 3, 'Os 3 aparelhos constam como devolvidos');
  assert(fullyReturned.returned_amount_usd === 1320, 'returned_amount_usd = total do pedido após devolução completa');
  assert((fullyReturned.total_amount_usd - fullyReturned.returned_amount_usd) === 0, 'Faturamento líquido final = US$ 0');

  const devicesAfterFull = await DataService.getDevices();
  assert(['111111111111111', '222222222222222', '333333333333333'].every(imei => {
    const d = devicesAfterFull.find(dv => dv.imei === imei);
    return d.status === 'Disponível';
  }), 'Todos os 3 aparelhos voltaram ao estoque como Disponível');

  // Nem a venda nem os devices foram apagados
  assert(orders.some(o => o.id === order.id), 'A venda original continua existindo (não foi apagada)');
  assert(devicesAfterFull.some(d => d.imei === '111111111111111'), 'Os devices continuam existindo no banco (não foram apagados)');

  // ================================================================
  // CENÁRIO: VENDA A PRAZO — DEVOLUÇÃO DEVE RECALCULAR PARCELAS ABERTAS
  // ================================================================
  console.log('\n--- CENÁRIO: Devolução em Venda a Prazo (parcelas abertas) ---');

  await DataService.createStockEntryBatch({
    reference_code: 'LOTE-RETURN-PRAZO',
    model: 'iPhone 14',
    storage: '256GB',
    grade_id: grades[0].id,
    unit_cost_usd: '400.00',
    suggested_price_usd: '500.00',
    quantity: 2,
    notes: ''
  }, [
    { imei: '444444444444444', color: 'Azul', battery_health: 95, cost_price_usd: '400.00', suggested_price_usd: '500.00' },
    { imei: '555555555555555', color: 'Azul', battery_health: 94, cost_price_usd: '400.00', suggested_price_usd: '500.00' }
  ], 'teste');

  const retailer2 = await DataService.saveRetailer({ store_name: 'Loja Prazo Teste', commission_per_unit_usd: 2 });

  const orderPrazo = await DataService.reserveOrder(
    { retailer_id: retailer2.id, notes: 'Venda a prazo' },
    [{ model: 'iPhone 14', storage: '256GB', grade_id: grades[0].id, quantity: 2, unit_price_usd: '500.00' }]
  );

  // Paga apenas US$ 300 à vista, parcela o restante (US$ 700) em 2x de US$ 350
  const today = new Date();
  const due1 = new Date(today); due1.setDate(today.getDate() + 15);
  const due2 = new Date(today); due2.setDate(today.getDate() + 30);

  await DataService.finalizeOrderSale(
    orderPrazo.id,
    [{ amount_usd: '300.00', method: 'PIX', exchange_rate: 5.14 }],
    [
      { number: 1, amount_usd: '350.00', due_date: due1.toISOString().split('T')[0] },
      { number: 2, amount_usd: '350.00', due_date: due2.toISOString().split('T')[0] }
    ]
  );

  let ordersPrazo = await DataService.getOrders();
  let finalizedPrazo = ordersPrazo.find(o => o.id === orderPrazo.id);
  assert(finalizedPrazo.balance_due_usd === 700, 'Saldo devedor inicial da venda a prazo = US$ 700 (1000 - 300 pago)');

  let installmentsAll = await DataService.getInstallments();
  let openBefore = installmentsAll.filter(i => i.order_id === orderPrazo.id && i.status !== 'Pago');
  assert(openBefore.length === 2, 'Existem 2 parcelas em aberto antes da devolução');
  assert(openBefore.reduce((s, i) => s + i.amount_usd, 0) === 700, 'Soma das parcelas em aberto = US$ 700');

  // Devolve 1 dos 2 aparelhos (US$ 500) — saldo devedor deve cair para US$ 200 (500 - 300 pago)
  const deviceToReturnPrazo = finalizedPrazo.allocated_devices[0];
  const returnPrazoResult = await DataService.registerSaleReturn(orderPrazo.id, [deviceToReturnPrazo.device_id], 'Defeito', '', 'teste');

  assert(returnPrazoResult.balance_due_usd === 200, 'Novo saldo devedor = US$ 200 (500 líquido - 300 já pago)');
  assert(returnPrazoResult.credit_due_usd === 0, 'Não há crédito devido (o pago ainda é menor que o novo líquido)');

  ordersPrazo = await DataService.getOrders();
  const afterReturnPrazo = ordersPrazo.find(o => o.id === orderPrazo.id);
  assert(afterReturnPrazo.balance_due_usd === 200, 'orders.balance_due_usd persistido corretamente em US$ 200');
  assert(afterReturnPrazo.status === 'Parcialmente Devolvida', 'Status da venda a prazo é Parcialmente Devolvida');

  installmentsAll = await DataService.getInstallments();
  const instAfter = installmentsAll.filter(i => i.order_id === orderPrazo.id);
  const stillOpenSum = instAfter.filter(i => i.status !== 'Pago').reduce((s, i) => s + i.amount_usd, 0);
  assert(stillOpenSum === 200, 'Soma das parcelas ainda em aberto recalculada para US$ 200 (nunca negativo, nunca incorreto)');

  const zeroedInstallment = instAfter.find(i => i.amount_usd === 0);
  assert(Boolean(zeroedInstallment) && zeroedInstallment.status === 'Pago', 'A parcela mais recente foi absorvida/cancelada pela devolução (marcada sem saldo)');

  console.log('================================================================');
  console.log(`🎉 TODOS OS ${totalTests} TESTES DE DEVOLUÇÃO FORAM APROVADOS! (${passedCount}/${totalTests})`);
  console.log('================================================================');
}

run().catch(err => {
  console.error('💥 ERRO NA AUDITORIA:', err.message);
  console.log(`\nResultado parcial: ${passedCount}/${totalTests} testes aprovados antes da falha.`);
  process.exit(1);
});
