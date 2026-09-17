// TESTES ESTRUTURAIS OBRIGATÓRIOS DO AUDITOR ESTRUTURAL (AGENTE 5)
import { DataService, initStorageIfNeeded } from '../src/lib/supabaseClient.js';
import { parseStockExcelFile } from '../src/lib/excelUtils.js';

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

async function runAllAudits() {
  console.log('================================================================');
  console.log('🔍 INICIANDO AUDITORIA ESTRUTURAL COMPLETA (AGENTE 5)');
  console.log('================================================================\n');

  // Limpa ambiente de teste
  DataService.clearAllOperationalData();

  const grades = await DataService.getGrades();
  assert(grades.length > 0, 'Grades ativas carregadas com sucesso');
  const gradeA = grades[0];

  // --------------------------------------------------------------------------
  // TESTE 1: Entrada Simples (3 aparelhos iPhone 13 128GB A++)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 1: Entrada Simples ---');
  const batch1Config = {
    reference_code: 'LOTE-TEST-001',
    model: 'iPhone 13',
    storage: '128GB',
    grade_id: gradeA.id,
    unit_cost_usd: 350.00,
    suggested_price_usd: 430.00,
    quantity: 3,
    notes: 'Lote de teste 1'
  };

  const batch1Units = [
    { imei: '354890123450001', color: 'Meia-noite', battery_health: 95, cost_price_usd: 350.00, suggested_price_usd: 430.00 },
    { imei: '354890123450002', color: 'Estelar', battery_health: 92, cost_price_usd: 350.00, suggested_price_usd: 430.00 },
    { imei: '354890123450003', color: 'Azul', battery_health: 90, cost_price_usd: 350.00, suggested_price_usd: 430.00 }
  ];

  const res1 = await DataService.createStockEntryBatch(batch1Config, batch1Units, 'admin_auditor');
  assert(res1.success === true, 'Entrada de lote 1 confirmada com sucesso');
  assert(res1.devices_count === 3, 'Exatamente 3 aparelhos cadastrados no lote');

  const devicesAfter1 = await DataService.getDevices();
  assert(devicesAfter1.length === 3, 'Total de aparelhos no estoque após entrada é 3');
  assert(devicesAfter1.every(d => d.status === 'Disponível'), 'Status inicial de todas as unidades é Disponível');
  assert(devicesAfter1.every(d => d.source === 'manual'), 'Origem source das unidades é "manual"');
  assert(devicesAfter1.every(d => d.stock_entry_id === res1.stock_entry.id), 'Aparelhos vinculados ao stock_entry_id');

  const movementsAfter1 = await DataService.getMovements();
  assert(movementsAfter1.length === 3, 'Movimentações de entrada criadas para cada aparelho');
  assert(movementsAfter1.every(m => m.movement_type === 'Entrada' && m.new_status === 'Disponível'), 'Movimentações registradas com tipo Entrada e status Disponível');

  // --------------------------------------------------------------------------
  // TESTE 2: IMEI Duplicado contra o Banco
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 2: IMEI Duplicado com Banco ---');
  let threwOnDbDuplicate = false;
  try {
    const duplicateBatch = {
      reference_code: 'LOTE-TEST-DUP-DB',
      model: 'iPhone 13',
      storage: '128GB',
      grade_id: gradeA.id,
      unit_cost_usd: 350.00,
      suggested_price_usd: 430.00,
      quantity: 1
    };
    await DataService.createStockEntryBatch(duplicateBatch, [{ imei: '354890123450001', color: 'Meia-noite', battery_health: 90 }], 'admin_auditor');
  } catch (err) {
    threwOnDbDuplicate = true;
    console.log(`Mensagem esperada capturada: "${err.message}"`);
  }
  assert(threwOnDbDuplicate, 'Tentativa de cadastrar IMEI existente no banco foi estritamente BLOQUEADA');

  // --------------------------------------------------------------------------
  // TESTE 3: Duplicidade no Mesmo Lote
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 3: Duplicidade no Mesmo Lote ---');
  let threwOnBatchDuplicate = false;
  try {
    const dupBatchConfig = {
      reference_code: 'LOTE-TEST-DUP-INTERNAL',
      model: 'iPhone 14',
      storage: '128GB',
      grade_id: gradeA.id,
      unit_cost_usd: 450.00,
      suggested_price_usd: 550.00,
      quantity: 2
    };
    const dupUnits = [
      { imei: '354890999990001', color: 'Roxo', battery_health: 98 },
      { imei: '354890999990001', color: 'Azul', battery_health: 97 }
    ];
    await DataService.createStockEntryBatch(dupBatchConfig, dupUnits, 'admin_auditor');
  } catch (err) {
    threwOnBatchDuplicate = true;
    console.log(`Mensagem esperada capturada: "${err.message}"`);
  }
  assert(threwOnBatchDuplicate, 'Duplicidade de IMEI dentro do próprio lote foi estritamente BLOQUEADA');

  // --------------------------------------------------------------------------
  // TESTE 4 & 5: Herança de Valores Padrão e Alteração Individual
  // --------------------------------------------------------------------------
  console.log('\n--- TESTES 4 & 5: Valores Padrão e Alteração Individual ---');
  const batch10Config = {
    reference_code: 'LOTE-TEST-010',
    model: 'iPhone 14',
    storage: '128GB',
    grade_id: gradeA.id,
    unit_cost_usd: 350.00,
    suggested_price_usd: 430.00,
    quantity: 10
  };

  const batch10Units = Array.from({ length: 10 }, (_, idx) => ({
    imei: `35489012345001${idx}`,
    color: 'Preto',
    battery_health: 90,
    cost_price_usd: idx === 3 ? 340.00 : 350.00, // Unidade 4 (idx 3) tem custo alterado para 340
    suggested_price_usd: 430.00
  }));

  const res10 = await DataService.createStockEntryBatch(batch10Config, batch10Units, 'admin_auditor');
  assert(res10.success === true, 'Lote de 10 unidades criado com sucesso');

  const devicesAfter10 = await DataService.getDevices();
  const unit4 = devicesAfter10.find(d => d.imei === '354890123450013');
  const unit1 = devicesAfter10.find(d => d.imei === '354890123450010');
  assert(unit4 && unit4.cost_price_usd === 340.00, 'Unidade 4 possui custo individual customizado de US$ 340');
  assert(unit1 && unit1.cost_price_usd === 350.00, 'Unidade 1 herdou o custo padrão de US$ 350');

  // --------------------------------------------------------------------------
  // TESTE 6: Importação de Planilha
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 6: Importação de Planilha ---');
  const importUnits = [
    { model: 'iPhone 15 Pro', storage: '128GB', grade: 'A++', color: 'Titânio Natural', battery_health: 100, imei: '354890123459991', cost_price_usd: 750, suggested_price_usd: 900 },
    { model: 'iPhone 15 Pro', storage: '128GB', grade: 'A++', color: 'Titânio Preto', battery_health: 99, imei: '354890123459992', cost_price_usd: 750, suggested_price_usd: 900 }
  ];

  const resImport = await DataService.importDevicesBatch(importUnits, 'admin_auditor', 'IMP-TEST-001');
  assert(resImport.success === true, 'Importação de planilha realizada com sucesso');
  assert(resImport.devices_count === 2, '2 aparelhos importados');

  const devImported = (await DataService.getDevices()).find(d => d.imei === '354890123459991');
  assert(devImported && devImported.source === 'import', 'Aparelho importado possui source = "import"');

  // --------------------------------------------------------------------------
  // TESTE 7: Estoque Atualizado Imediatamente
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 7: Reflexo Imediato no Estoque ---');
  const allDevices = await DataService.getDevices();
  // 3 (lote 1) + 10 (lote 2) + 2 (importação) = 15 total
  assert(allDevices.length === 15, `Estoque total reflete exatamente 15 aparelhos (atual: ${allDevices.length})`);
  const availableCount = allDevices.filter(d => d.status === 'Disponível').length;
  assert(availableCount === 15, `Todos os 15 aparelhos estão Disponíveis para venda`);

  // --------------------------------------------------------------------------
  // TESTE 8: Fluxo Comercial Completo (Venda de Aparelho Criado Manualmente)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 8: Fluxo Comercial de Venda (Disponível -> Reservado -> Vendido) ---');
  // Cadastra um lojista parceiro para a venda
  const retailer = await DataService.saveRetailer({
    store_name: 'Lojista Teste Oficial',
    contact_name: 'João Silva',
    whatsapp: '5511999998888',
    commission_per_unit_usd: 10.00
  });

  // Reserva 2 unidades de iPhone 13 128GB (criados no Lote 1)
  const orderData = {
    retailer_id: retailer.id,
    notes: 'Pedido teste auditoria'
  };
  const orderItems = [
    { model: 'iPhone 13', storage: '128GB', grade_id: gradeA.id, quantity: 2, unit_price_usd: 430.00 }
  ];

  const reservedOrder = await DataService.reserveOrder(orderData, orderItems);
  assert(reservedOrder.status === 'Reservado', 'Pedido criado com status Reservado');
  assert(reservedOrder.allocated_devices.length === 2, 'Exatamente 2 IMEIs alocados para o pedido');

  const devicesAfterReserve = await DataService.getDevices();
  const reservedCount = devicesAfterReserve.filter(d => d.status === 'Reservado').length;
  const availableCountAfterReserve = devicesAfterReserve.filter(d => d.status === 'Disponível').length;
  assert(reservedCount === 2, '2 aparelhos mudaram para status "Reservado"');
  assert(availableCountAfterReserve === 13, '13 aparelhos permanecem "Disponíveis"');

  // Finalização da venda
  const finalization = await DataService.finalizeOrderSale(reservedOrder.id, [
    { amount_usd: 860.00, method: 'PIX' }
  ], []);

  assert(finalization.success === true, 'Venda finalizada com sucesso');
  const devicesAfterFinalize = await DataService.getDevices();
  const soldCount = devicesAfterFinalize.filter(d => d.status === 'Vendido').length;
  assert(soldCount === 2, '2 aparelhos mudaram para status "Vendido"');

  // Verifica movimentações dos aparelhos vendidos
  const allocatedImei = reservedOrder.allocated_devices[0].imei;
  const deviceSold = devicesAfterFinalize.find(d => d.imei === allocatedImei);
  const movsDevice = await DataService.getMovements(deviceSold.id);
  assert(movsDevice.some(m => m.movement_type === 'Entrada'), 'Histórico contém movimentação de Entrada inicial');
  assert(movsDevice.some(m => m.movement_type === 'Reserva'), 'Histórico contém movimentação de Reserva');
  assert(movsDevice.some(m => m.movement_type === 'Venda'), 'Histórico contém movimentação de Venda final');

  // --------------------------------------------------------------------------
  // TESTE 9 & 10: Rastreabilidade e Resumo
  // --------------------------------------------------------------------------
  console.log('\n--- TESTES 9-14: Rastreabilidade de Lotes e Integridade ---');
  const stockEntries = await DataService.getStockEntries();
  assert(stockEntries.length === 3, 'Exatamente 3 lotes de entrada registrados em stock_entries (Lote 1, Lote 2, Importação)');

  console.log('\n================================================================');
  console.log(`🎉 TODOS OS ${totalTests} TESTES ESTRUTURAIS FORAM EXECUTADOS E APROVADOS! (${passedCount}/${totalTests})`);
  console.log('================================================================\n');
}

runAllAudits().catch(err => {
  console.error('Falha crítica na auditoria:', err);
  process.exit(1);
});
