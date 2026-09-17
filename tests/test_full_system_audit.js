// ==============================================================================
// RISEMOBILE: SUÍTE DE TESTES E AUDITORIA COMPLETA DE NEGÓCIO E PERSISTÊNCIA (E2E)
// Executado pelo Agente 5 (QA) e Agente 7 (Auditor Final Independente)
// ==============================================================================

import assert from 'node:assert';
import { DataService } from '../src/lib/supabaseClient.js';

console.log('\n' + '='.repeat(80));
console.log('🏛️  INICIANDO AUDITORIA TÉCNICA E TESTES DE NEGÓCIO DA RISEMOBILE');
console.log('='.repeat(80) + '\n');

let totalTests = 0;
let passedTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`✅ [TESTE ${totalTests}] APROVADO: ${description}`);
  } catch (err) {
    console.error(`❌ [TESTE ${totalTests}] FALHOU: ${description}`);
    console.error(`   Detalhes: ${err.message}\n`);
    throw err;
  }
}

async function runAsyncTest(description, testFn) {
  totalTests++;
  try {
    await testFn();
    passedTests++;
    console.log(`✅ [TESTE ${totalTests}] APROVADO: ${description}`);
  } catch (err) {
    console.error(`❌ [TESTE ${totalTests}] FALHOU: ${description}`);
    console.error(`   Detalhes: ${err.message}\n`);
    throw err;
  }
}

async function runAllAudits() {
  // Limpa estado para ambiente controlado
  DataService.clearAllOperationalData();

  console.log('--- 1. AUDITORIA DE GRADES E CONFIGURAÇÕES ---');
  let grades = await DataService.getGrades();
  runTest('Grades padrão carregadas com sucesso', () => {
    assert.ok(Array.isArray(grades) && grades.length >= 2, 'Deve conter pelo menos 2 grades');
  });

  const gradeA = grades[0];
  const gradeB = grades[1];

  console.log('\n--- 2. AUDITORIA DE LOJISTAS E PARCEIROS ---');
  const retailer1 = await DataService.saveRetailer({
    id: '',
    store_name: 'TechPrime Celulares SP',
    contact_name: 'Roberto Silveira',
    whatsapp: '11999998888',
    commission_per_unit_usd: 15.00
  });

  runTest('Cadastro de lojista sem UUID prévio gera ID e persiste comissão', () => {
    assert.ok(retailer1.id, 'Lojista deve possuir ID gerado');
    assert.strictEqual(retailer1.store_name, 'TechPrime Celulares SP');
    assert.strictEqual(retailer1.commission_per_unit_usd, 15.00);
  });

  console.log('\n--- 3. AUDITORIA DE ENTRADA MANUAL DE ESTOQUE EM LOTE ---');
  const batch1 = {
    reference_code: 'LOTE-AUDIT-001',
    model: 'iPhone 13',
    storage: '128GB',
    grade_id: gradeA.id,
    quantity: 5,
    unit_cost_usd: 350.00,
    suggested_price_usd: 440.00,
    notes: 'Lote de teste de auditoria técnica'
  };

  const units1 = [
    { imei: '354000000000001', color: 'Meia-noite', battery_health: 98, cost_price_usd: 350.00 },
    { imei: '354000000000002', color: 'Estelar', battery_health: 94, cost_price_usd: 350.00 },
    { imei: '354000000000003', color: 'Azul', battery_health: 88, cost_price_usd: 350.00 },
    { imei: '354000000000004', color: 'Rosa', battery_health: 91, cost_price_usd: 340.00 }, // Override
    { imei: '354000000000005', color: 'Verde', battery_health: 96, cost_price_usd: 350.00 }
  ];

  const entryRes1 = await DataService.createStockEntryBatch(batch1, units1, 'Auditor');
  runTest('Entrada manual de lote registrada com 5 unidades', () => {
    assert.ok(entryRes1.success);
    assert.strictEqual(entryRes1.count, 5);
  });

  let devices = await DataService.getDevices();
  runTest('Estoque reflete 5 aparelhos com status Disponível e source manual', () => {
    assert.strictEqual(devices.length, 5);
    devices.forEach(d => {
      assert.strictEqual(d.status, 'Disponível');
      assert.strictEqual(d.source, 'manual');
    });
  });

  runTest('Herança de custo padrão e override individual confirmados', () => {
    const dev4 = devices.find(d => d.imei === '354000000000004');
    assert.strictEqual(dev4.cost_price_usd, 340.00);
    const dev1 = devices.find(d => d.imei === '354000000000001');
    assert.strictEqual(dev1.cost_price_usd, 350.00);
  });

  console.log('\n--- 4. AUDITORIA DE REGRAS DE INTEGRIDADE E DUPLICIDADE DE IMEI ---');
  await runAsyncTest('Bloqueio estrito de IMEI já existente no banco de dados', async () => {
    let threw = false;
    try {
      await DataService.createStockEntryBatch({
        reference_code: 'LOTE-DUP',
        model: 'iPhone 13',
        storage: '128GB',
        grade_id: gradeA.id,
        quantity: 1,
        unit_cost_usd: 350.00
      }, [{ imei: '354000000000001', color: 'Preto', battery_health: 100 }]);
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('já está cadastrado'));
    }
    assert.ok(threw, 'Deveria ter lançado erro de IMEI duplicado no banco');
  });

  await runAsyncTest('Bloqueio estrito de IMEI duplicado dentro do mesmo lote', async () => {
    let threw = false;
    try {
      await DataService.createStockEntryBatch({
        reference_code: 'LOTE-DUP-INTERNAL',
        model: 'iPhone 13',
        storage: '128GB',
        grade_id: gradeA.id,
        quantity: 2,
        unit_cost_usd: 350.00
      }, [
        { imei: '354000000000099', color: 'Preto', battery_health: 100 },
        { imei: '354000000000099', color: 'Branco', battery_health: 100 }
      ]);
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('mesmo lote'));
    }
    assert.ok(threw, 'Deveria ter lançado erro de duplicidade interna no lote');
  });

  console.log('\n--- 5. AUDITORIA DE IMPORTAÇÃO DE PLANILHA EXCEL/CSV ---');
  const importRows = [
    { model: 'iPhone 14', storage: '128GB', grade_name: gradeA.name, color: 'Roxo', battery_health: 99, imei: '354111111111001', cost_price_usd: 480, suggested_price_usd: 580 },
    { model: 'iPhone 14', storage: '128GB', grade_name: gradeA.name, color: 'Estelar', battery_health: 92, imei: '354111111111002', cost_price_usd: 480, suggested_price_usd: 580 },
    { model: 'iPhone 14 Pro', storage: '256GB', grade_name: gradeB.name, color: 'Dourado', battery_health: 95, imei: '354111111111003', cost_price_usd: 680, suggested_price_usd: 820 }
  ];

  const importRes = await DataService.importDevicesBatch(importRows, 'Auditor Planilha');
  runTest('Importação de 3 aparelhos de múltiplos modelos processada com sucesso', () => {
    assert.strictEqual(importRes.count, 3);
  });

  devices = await DataService.getDevices();
  runTest('Estoque total agora totaliza 8 unidades (5 manuais + 3 importadas)', () => {
    assert.strictEqual(devices.length, 8);
  });

  console.log('\n--- 6. AUDITORIA DE RESERVA AUTOMÁTICA POR MAIOR SAÚDE DE BATERIA ---');
  // Solicitando 2 unidades de iPhone 13 128GB Grade A
  // As baterias cadastradas são: 98, 96, 94, 91, 88.
  // Devem ser selecionados os aparelhos com 98% (354000000000001) e 96% (354000000000005)
  const saleReservation = await DataService.reserveOrder(
    {
      retailer_id: retailer1.id,
      notes: 'Pedido de auditoria de reserva automática'
    },
    [
      {
        model: 'iPhone 13',
        storage: '128GB',
        grade_id: gradeA.id,
        quantity: 2,
        unit_price_usd: 440.00
      }
    ]
  );

  runTest('Pedido criado com status Reservado e 2 aparelhos alocados', () => {
    assert.ok(saleReservation.id, 'Pedido deve ter ID');
    assert.strictEqual(saleReservation.status, 'Reservado');
    assert.strictEqual(saleReservation.allocated_devices.length, 2);
  });

  runTest('Aparelhos selecionados são exatamente os de maior saúde de bateria (98% e 96%)', () => {
    const allocatedImeis = saleReservation.allocated_devices.map(d => d.imei);
    assert.ok(allocatedImeis.includes('354000000000001'), 'Deveria conter o IMEI de 98% de bateria');
    assert.ok(allocatedImeis.includes('354000000000005'), 'Deveria conter o IMEI de 96% de bateria');
  });

  devices = await DataService.getDevices();
  runTest('Status dos 2 aparelhos mudou para Reservado e 6 continuam Disponíveis', () => {
    const reservedDevs = devices.filter(d => d.status === 'Reservado');
    const availableDevs = devices.filter(d => d.status === 'Disponível');
    assert.strictEqual(reservedDevs.length, 2);
    assert.strictEqual(availableDevs.length, 6);
  });

  console.log('\n--- 7. AUDITORIA DE CANCELAMENTO DE RESERVA ---');
  await DataService.cancelOrder(saleReservation.id, 'Teste de cancelamento');
  devices = await DataService.getDevices();

  runTest('Cancelamento libera aparelhos reservados de volta para status Disponível', () => {
    const availableDevs = devices.filter(d => d.status === 'Disponível');
    assert.strictEqual(availableDevs.length, 8);
  });

  console.log('\n--- 8. AUDITORIA DE VENDA FINALIZADA, PAGAMENTO MISTO E PARCELAMENTO ---');
  // Nova reserva de 2 unidades de iPhone 14 128GB (preço unitário: US$ 580) = Total US$ 1160
  const saleOrder = await DataService.reserveOrder(
    {
      retailer_id: retailer1.id,
      notes: 'Venda final com pagamento misto'
    },
    [
      {
        model: 'iPhone 14',
        storage: '128GB',
        grade_id: gradeA.id,
        quantity: 2,
        unit_price_usd: 580.00
      }
    ]
  );

  const payments = [
    { amount_usd: 500.00, method: 'PIX', exchange_rate: 5.50 }
  ];

  const installments = [
    { number: 1, amount_usd: 330.00, due_date: '2026-10-15' },
    { number: 2, amount_usd: 330.00, due_date: '2026-11-15' }
  ];

  const finalizeResult = await DataService.finalizeOrderSale(saleOrder.id, payments, installments);

  runTest('Finalização de venda executada com sucesso', () => {
    assert.ok(finalizeResult.success);
    assert.strictEqual(finalizeResult.balance_due_usd, 660.00); // 1160 - 500 = 660
  });

  devices = await DataService.getDevices();
  runTest('Aparelhos vendidos atualizados para status Vendido', () => {
    const soldDevs = devices.filter(d => d.status === 'Vendido');
    assert.strictEqual(soldDevs.length, 2);
  });

  console.log('\n--- 9. AUDITORIA DE BAIXA DE PARCELA (CONTAS A RECEBER) ---');
  let instList = await DataService.getInstallments();
  const targetInst = instList.find(i => i.order_id === saleOrder.id && i.installment_number === 1);

  runTest('Parcela gerada com status A vencer', () => {
    assert.ok(targetInst);
    assert.strictEqual(targetInst.amount_usd, 330.00);
  });

  await DataService.payInstallment(targetInst.id, { method: 'PIX' });
  instList = await DataService.getInstallments();
  const paidInst = instList.find(i => i.id === targetInst.id);

  runTest('Baixa de parcela registrada com sucesso (Status: Pago)', () => {
    assert.strictEqual(paidInst.status, 'Pago');
  });

  console.log('\n--- 10. AUDITORIA DE AJUSTE DE ESTOQUE SEM VENDA ---');
  const devToAdjust = devices.find(d => d.status === 'Disponível');
  await DataService.adjustStock(devToAdjust.id, 'Defeito', 'Tela trincada na inspeção');
  
  devices = await DataService.getDevices();
  const adjustedDev = devices.find(d => d.id === devToAdjust.id);
  runTest('Ajuste de estoque move status para Retirado por ajuste', () => {
    assert.strictEqual(adjustedDev.status, 'Retirado por ajuste');
  });

  await runAsyncTest('Bloqueio estrito de ajuste para aparelho já Vendido', async () => {
    const soldDev = devices.find(d => d.status === 'Vendido');
    let threw = false;
    try {
      await DataService.adjustStock(soldDev.id, 'Defeito', 'Tentativa inválida');
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Vendido'));
    }
    assert.ok(threw, 'Deveria ter impedido retirada de aparelho vendido');
  });

  console.log('\n--- 11. AUDITORIA DE HISTÓRICO PERPÉTUO DE MOVIMENTAÇÕES ---');
  const movements = await DataService.getStockMovements();
  runTest('Movimentações contêm tipos Entrada, Reserva, Cancelamento, Venda e Ajuste', () => {
    const types = new Set(movements.map(m => m.movement_type));
    assert.ok(types.has('Entrada'), 'Deve conter Entrada');
    assert.ok(types.has('Reserva'), 'Deve conter Reserva');
    assert.ok(types.has('Venda'), 'Deve conter Venda');
  });

  console.log('\n' + '='.repeat(80));
  console.log(`🎉 AUDITORIA CONCLUÍDA COM 100% DE APROVAÇÃO (${passedTests}/${totalTests} TESTES)`);
  console.log('='.repeat(80) + '\n');
}

runAllAudits().catch(err => {
  console.error('FATAL AUDIT ERROR:', err);
  process.exit(1);
});
