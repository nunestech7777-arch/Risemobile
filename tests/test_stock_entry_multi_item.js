// TESTE: Entrada de Estoque com Múltiplos Modelos no Mesmo Lote
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
  console.log('🔍 TESTE — LOTE COM MÚLTIPLOS MODELOS/CONFIGURAÇÕES');
  console.log('================================================================');

  initStorageIfNeeded();
  const grades = await DataService.getGrades();
  const gradeA = grades.find(g => g.name === 'A++') || grades[0];
  const gradeAB = grades.find(g => g.name === 'AB+') || grades[0];

  const header = { reference_code: 'LOTE-TESTE-001', notes: 'Miami' };

  const items = [
    {
      model: 'iPhone 13',
      storage: '128GB',
      grade_id: gradeA.id,
      unit_cost_usd: '350.00',
      suggested_price_usd: '430.00',
      units: [
        { imei: '600000000000001', color: 'Preto', battery_health: 95, cost_price_usd: '350.00', suggested_price_usd: '430.00' },
        { imei: '600000000000002', color: 'Preto', battery_health: 94, cost_price_usd: '350.00', suggested_price_usd: '430.00' }
      ]
    },
    {
      model: 'iPhone 14',
      storage: '256GB',
      grade_id: gradeAB.id,
      unit_cost_usd: '420.00',
      suggested_price_usd: '520.00',
      units: [
        { imei: '600000000000003', color: 'Azul', battery_health: 92, cost_price_usd: '420.00', suggested_price_usd: '520.00' },
        { imei: '600000000000004', color: 'Azul', battery_health: 91, cost_price_usd: '420.00', suggested_price_usd: '520.00' },
        { imei: '600000000000005', color: 'Azul', battery_health: 90, cost_price_usd: '420.00', suggested_price_usd: '520.00' }
      ]
    },
    {
      model: 'iPhone 15 Pro',
      storage: '256GB',
      grade_id: gradeA.id,
      unit_cost_usd: '780.00',
      suggested_price_usd: '920.00',
      units: [
        { imei: '600000000000006', color: 'Titânio Natural', battery_health: 99, cost_price_usd: '780.00', suggested_price_usd: '920.00' }
      ]
    }
  ];

  const result = await DataService.createStockEntryBatchMulti(header, items, 'teste');

  assert(result.success === true, 'Lote multi-item confirmado com sucesso');
  assert(result.total_items === 3, 'Resultado indica exatamente 3 itens/configurações');
  assert(result.total_quantity === 6, 'Resultado indica exatamente 6 aparelhos no total');
  assert(result.total_cost_usd === (350 * 2 + 420 * 3 + 780 * 1), 'Custo total do lote está correto (2350)');

  const stockEntries = await DataService.getStockEntries();
  const createdEntries = stockEntries.filter(e => e.reference_code === 'LOTE-TESTE-001');
  assert(createdEntries.length === 1, 'Foi criado exatamente 1 LOTE (não 3 lotes separados)');
  assert(createdEntries[0].quantity === 6, 'O lote único registra quantidade agregada de 6 aparelhos');

  const devices = await DataService.getDevices();
  const imeis = ['600000000000001', '600000000000002', '600000000000003', '600000000000004', '600000000000005', '600000000000006'];
  const createdDevices = devices.filter(d => imeis.includes(d.imei));
  assert(createdDevices.length === 6, 'Os 6 aparelhos foram criados no estoque');
  assert(createdDevices.every(d => d.status === 'Disponível'), 'Todos os 6 aparelhos estão Disponível');

  const iphone13Devices = createdDevices.filter(d => d.model === 'iPhone 13');
  const iphone14Devices = createdDevices.filter(d => d.model === 'iPhone 14');
  const iphone15Devices = createdDevices.filter(d => d.model === 'iPhone 15 Pro');
  assert(iphone13Devices.length === 2, 'Exatamente 2 iPhone 13 foram criados');
  assert(iphone14Devices.length === 3, 'Exatamente 3 iPhone 14 foram criados');
  assert(iphone15Devices.length === 1, 'Exatamente 1 iPhone 15 Pro foi criado');

  assert(iphone13Devices.every(d => d.cost_price_usd === 350), 'iPhone 13: custo do ITEM 1 (350) foi respeitado, não misturado com outros itens');
  assert(iphone14Devices.every(d => d.cost_price_usd === 420), 'iPhone 14: custo do ITEM 2 (420) foi respeitado, não misturado com outros itens');
  assert(iphone15Devices.every(d => d.cost_price_usd === 780), 'iPhone 15 Pro: custo do ITEM 3 (780) foi respeitado, não misturado com outros itens');

  assert(iphone13Devices.every(d => d.stock_entry_id === createdEntries[0].id), 'Todos os aparelhos apontam para o mesmo lote de entrada');

  // Cada configuração continua aparecendo separadamente no estoque (não mistura produtos)
  const distinctConfigs = new Set(createdDevices.map(d => `${d.model}|${d.storage}`));
  assert(distinctConfigs.size === 3, 'As 3 configurações continuam distintas no estoque (não foram misturadas)');

  // ---- BLOQUEIO: IMEI duplicado ENTRE itens do mesmo lote ----
  let blockedCrossItemDuplicate = false;
  try {
    await DataService.createStockEntryBatchMulti(
      { reference_code: 'LOTE-TESTE-002', notes: '' },
      [
        { model: 'iPhone 13', storage: '128GB', grade_id: gradeA.id, unit_cost_usd: '350.00', suggested_price_usd: '430.00',
          units: [{ imei: '600000000000099', color: 'Preto', battery_health: 95, cost_price_usd: '350.00', suggested_price_usd: '430.00' }] },
        { model: 'iPhone 14', storage: '256GB', grade_id: gradeAB.id, unit_cost_usd: '420.00', suggested_price_usd: '520.00',
          units: [{ imei: '600000000000099', color: 'Azul', battery_health: 92, cost_price_usd: '420.00', suggested_price_usd: '520.00' }] }
      ],
      'teste'
    );
  } catch (err) {
    blockedCrossItemDuplicate = true;
  }
  assert(blockedCrossItemDuplicate, 'IMEI duplicado entre itens diferentes do mesmo lote é bloqueado');

  // Garante que a tentativa bloqueada não deixou nenhum aparelho parcial cadastrado (rollback)
  const devicesAfterFailure = await DataService.getDevices();
  assert(!devicesAfterFailure.some(d => d.imei === '600000000000099'), 'Nenhum aparelho da tentativa bloqueada foi criado (sem entrada parcial)');

  console.log('================================================================');
  console.log(`🎉 TODOS OS ${totalTests} TESTES DE LOTE MULTI-ITEM FORAM APROVADOS! (${passedCount}/${totalTests})`);
  console.log('================================================================');
}

run().catch(err => {
  console.error('💥 ERRO NA AUDITORIA:', err.message);
  console.log(`\nResultado parcial: ${passedCount}/${totalTests} testes aprovados antes da falha.`);
  process.exit(1);
});
