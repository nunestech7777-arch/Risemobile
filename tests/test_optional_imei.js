// TESTE: IMEI/Serial, cor e bateria OPCIONAIS no cadastro de aparelhos (motor local do DataService)
import { DataService, initStorageIfNeeded } from '../src/lib/supabaseClient.js';
import { formatImei, formatImeiLabel, formatColor, formatBattery, getBatteryHealthBadge, getDeviceCompleteness } from '../src/lib/formatters.js';

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

async function rejects(fn, pattern, message) {
  let error = null;
  try { await fn(); } catch (e) { error = e; }
  assert(error && pattern.test(error.message), `${message} (${error ? error.message : 'não lançou erro'})`);
}

async function run() {
  console.log('================================================================');
  console.log('🔍 TESTE — IMEI / SERIAL / COR / BATERIA OPCIONAIS');
  console.log('================================================================');

  initStorageIfNeeded();
  const grades = await DataService.getGrades();
  const gradeA = grades.find(g => g.name === 'A++') || grades[0];
  const header = (n) => ({ reference_code: `LOTE-OPC-${n}`, notes: '' });
  const item = (extra) => ({ model: 'iPhone 13', storage: '128GB', grade_id: gradeA.id, ...extra });
  const countDevices = async () => (await DataService.getDevices()).length;

  console.log('\n--- Teste 1: só modelo + armazenamento + grade + quantidade ---');
  const startCount = await countDevices();
  const r1 = await DataService.createStockEntryBatchMulti(header(1), [
    item({ quantity: 10, unit_cost_usd: '350.00', suggested_price_usd: '430.00' })
  ]);
  assert(r1.total_quantity === 10, '10 unidades criadas informando apenas quantidade');
  const created = (await DataService.getDevices()).slice(0, 10);
  assert((await countDevices()) === startCount + 10, 'Estoque aumentou exatamente 10 unidades');
  assert(created.every(d => d.status === 'Disponível'), 'Todas nascem Disponível');
  assert(created.every(d => d.imei === null && d.color === null && d.battery_health === null),
    'IMEI, cor e bateria ficam vazios (sem "Padrão"/100 inventados)');
  assert(created.every(d => d.cost_price_usd === 350 && d.suggested_price_usd === 430),
    'Cada unidade herda custo e preço sugerido padrão');
  assert(new Set(created.map(d => d.id)).size === 10, 'Cada unidade tem id interno próprio');

  console.log('\n--- Teste 1b: sem custo e sem preço ---');
  const r1b = await DataService.createStockEntryBatchMulti(header('1b'), [item({ model: 'iPhone 14', quantity: 3 })]);
  assert(r1b.total_quantity === 3, '3 unidades criadas sem custo nem preço');
  const noPrice = (await DataService.getDevices()).filter(d => d.model === 'iPhone 14');
  assert(noPrice.every(d => d.cost_price_usd === 0 && d.suggested_price_usd === 0), 'Custo/preço ficam 0 (não informado)');

  console.log('\n--- Testes 2/3/6/7: IMEI vazio, sem cor, sem bateria ---');
  const blankUnits = [
    { imei: '' }, { imei: '   ' }, { imei: null }, {}, { imei: '', color: '', battery_health: '' }
  ];
  const r2 = await DataService.createStockEntryBatchMulti(header(2), [item({ model: 'iPhone 15', units: blankUnits })]);
  assert(r2.total_quantity === 5, '5 aparelhos com IMEI vazio/espaços/null/ausente aceitos');
  const blanks = (await DataService.getDevices()).filter(d => d.model === 'iPhone 15');
  assert(blanks.every(d => d.imei === null), 'IMEI vazio é normalizado para null');
  assert(blanks.every(d => d.color === null), 'Aparelho sem cor permitido');
  assert(blanks.every(d => d.battery_health === null), 'Aparelho sem bateria permitido');

  console.log('\n--- Teste 4/5: IMEI/Serial preenchido continua único ---');
  await DataService.createStockEntryBatchMulti(header(3), [item({ model: 'iPhone 12', units: [{ imei: '350000000000001' }, { imei: 'SERIAL9A' }, {}] })]);
  await rejects(
    () => DataService.createStockEntryBatchMulti(header(4), [item({ units: [{ imei: '350000000000001' }] })]),
    /já está cadastrado/, 'IMEI já existente no estoque é bloqueado'
  );
  await rejects(
    () => DataService.createStockEntryBatchMulti(header(5), [item({ units: [{ imei: 'serial9a' }] })]),
    /já está cadastrado/, 'Serial já existente é bloqueado (sem diferenciar maiúsculas)'
  );
  await rejects(
    () => DataService.createStockEntryBatchMulti(header(6), [item({ units: [{ imei: '350000000000009' }, {}, { imei: '350000000000009' }] })]),
    /duplicado/, 'Dois aparelhos com o mesmo IMEI no mesmo lote são bloqueados'
  );
  await rejects(
    () => DataService.createStockEntryBatchMulti(header(7), [
      item({ units: [{ imei: '350000000000010' }] }),
      item({ model: 'iPhone 14', units: [{ imei: '350000000000010' }] })
    ]),
    /duplicado/, 'Mesmo IMEI repetido entre itens do lote é bloqueado'
  );
  assert(!(await DataService.getDevices()).some(d => d.imei === '350000000000009' || d.imei === '350000000000010'),
    'Lote bloqueado não deixa entrada parcial');

  console.log('\n--- Entrada simples (rpc legada) também aceita sem IMEI ---');
  const legacy = await DataService.createStockEntryBatch(
    { reference_code: 'LEG-OPC', model: 'iPhone 11', storage: '64GB', grade_id: gradeA.id, quantity: 3, unit_cost_usd: '200', suggested_price_usd: '260' },
    [{}, { imei: '' }, { imei: '350000000000020' }]
  );
  assert(legacy.count === 3, 'Entrada simples com 3 unidades e só 1 IMEI');

  console.log('\n--- Só modelo/armazenamento/grade são obrigatórios ---');
  await rejects(() => DataService.createStockEntryBatchMulti(header(8), [{ model: 'iPhone 13', storage: '128GB', quantity: 2 }]),
    /modelo, armazenamento e grade/, 'Grade ausente é rejeitada');
  await rejects(() => DataService.createStockEntryBatchMulti(header(9), [item({})]),
    /não possui unidades/, 'Sem quantidade e sem unidades é rejeitado');
  await rejects(() => DataService.createStockEntryBatchMulti(header(10), [item({ quantity: 501 })]),
    /limite/, 'Quantidade acima do limite por item é rejeitada');

  console.log('\n--- Teste 10/11: importação ---');
  const importBefore = await countDevices();
  const rows = Array.from({ length: 4 }, () => ({ model: 'iPhone 13', storage: '128GB', grade_id: gradeA.id, color: '', battery_health: null, imei: '', cost_price_usd: 350, suggested_price_usd: 430 }));
  const imp = await DataService.importDevicesBatch(rows, 'admin', 'IMP-OPC-1');
  assert(imp.count === 4 && (await countDevices()) === importBefore + 4, 'Importação de várias linhas sem IMEI permitida');
  const imported = (await DataService.getDevices()).slice(0, 4);
  assert(imported.every(d => d.imei === null && d.color === null && d.battery_health === null), 'Linhas importadas ficam sem IMEI/cor/bateria');
  await rejects(
    () => DataService.importDevicesBatch([{ ...rows[0], imei: '350000000000030' }, { ...rows[0], imei: '350000000000030' }], 'admin'),
    /duplicado/, 'IMEI duplicado dentro do arquivo é bloqueado'
  );
  await rejects(
    () => DataService.importDevicesBatch([{ ...rows[0], imei: '350000000000001' }], 'admin'),
    /já está cadastrado/, 'IMEI de arquivo que já existe no estoque é bloqueado'
  );
  assert(!(await DataService.getDevices()).some(d => d.imei === '350000000000030'), 'Importação bloqueada não grava nada');

  console.log('\n--- Teste 8/9: reserva e venda de aparelho sem IMEI (por modelo + armazenamento + grade) ---');
  const retailer = await DataService.saveRetailer({ store_name: 'Loja Sem IMEI', contact_name: 'Teste', whatsapp: '5511999990000', commission_per_unit_usd: 5 });
  const order2 = await DataService.reserveOrder(
    { retailer_id: retailer.id, notes: 'sem imei' },
    [{ model: 'iPhone 14', storage: '128GB', grade_id: gradeA.id, quantity: 2, unit_price_usd: 430 }]
  );
  assert(order2.status === 'Reservado' && order2.allocated_devices.length === 2, 'Reserva de 2 aparelhos sem IMEI concluída');
  assert(order2.allocated_devices.every(d => d.device_id && d.imei === null), 'Alocação usa o id interno (device_id); IMEI segue vazio');
  const sale = await DataService.finalizeOrderSale(order2.id, [{ amount_usd: 860, method: 'PIX' }], []);
  assert(sale.success === true, 'Venda de aparelhos sem IMEI finalizada');
  const afterSale = await DataService.getDevices();
  const soldIds = order2.allocated_devices.map(d => d.device_id);
  assert(afterSale.filter(d => soldIds.includes(d.id)).every(d => d.status === 'Vendido'), 'Aparelhos ficam Vendido');
  const movs = await DataService.getMovements(soldIds[0]);
  assert(['Entrada', 'Reserva', 'Venda'].every(t => movs.some(m => m.movement_type === t)), 'Histórico completo pelo id interno do aparelho');

  console.log('\n--- Teste 12 (parcial): exibição segura de campos vazios ---');
  assert(formatImei(null) === '—' && formatImei('') === '—' && formatImei(undefined) === '—', 'IMEI vazio exibe "—"');
  assert(formatImei(null, 'IMEI não informado') === 'IMEI não informado', 'Fallback de IMEI configurável');
  assert(formatImeiLabel(null) === 'IMEI não informado' && formatImeiLabel('354890123456789').startsWith('IMEI: '), 'Rótulo de IMEI');
  assert(formatColor(null) === '—' && formatColor('  ') === '—' && formatColor('Azul') === 'Azul', 'Cor vazia exibe "—"');
  assert(formatBattery(null) === '—' && formatBattery('') === '—' && formatBattery(0) === '0%' && formatBattery(92) === '92%', 'Bateria vazia exibe "—" e 0% continua 0%');
  assert(getBatteryHealthBadge(null).label === '—', 'Badge de bateria sem valor não mostra "0%"');
  assert(getDeviceCompleteness({ imei: null, color: 'Azul', battery_health: 90 }).complete === false, 'Sem IMEI = incompleto');
  assert(getDeviceCompleteness({ imei: '1', color: 'Azul', battery_health: 0 }).complete === true, 'Todos os dados (bateria 0 incluída) = completo');

  console.log('\n--- Edição posterior dos dados (updateDevice) ---');
  const free = (await DataService.getDevices()).filter(d => d.status === 'Disponível' && !d.imei);
  const [a, b] = free;
  const updated = await DataService.updateDevice(a.id, { imei: '350000000000040', color: 'Azul', battery_health: '91', cost_price_usd: '', suggested_price_usd: '450' });
  assert(updated.imei === '350000000000040' && updated.color === 'Azul' && updated.battery_health === 91, 'IMEI, cor e bateria preenchidos depois');
  assert(updated.status === 'Disponível', 'Editar dados não altera o status comercial');
  await rejects(() => DataService.updateDevice(b.id, { imei: '350000000000040' }), /já está cadastrado/, 'Editar para IMEI de outro aparelho é bloqueado');
  await rejects(() => DataService.updateDevice(b.id, { imei: 'serial9a' }), /já está cadastrado/, 'Editar para serial existente é bloqueado');
  const same = await DataService.updateDevice(a.id, { imei: '350000000000040', battery_health: '' });
  assert(same.imei === '350000000000040' && same.battery_health === null, 'Reenviar o próprio IMEI não conflita; bateria pode voltar a vazio');
  const cleared = await DataService.updateDevice(a.id, { imei: '  ' });
  assert(cleared.imei === null, 'Limpar o IMEI volta a null');
  await rejects(() => DataService.updateDevice(b.id, { battery_health: '150' }), /entre 0 e 100/, 'Bateria fora de 0–100 é rejeitada');
  await rejects(() => DataService.updateDevice(soldIds[0], { cost_price_usd: '1' }), /vendido/, 'Custo de aparelho vendido não pode mudar');
  const soldEdit = await DataService.updateDevice(soldIds[0], { imei: '350000000000050' });
  assert(soldEdit.imei === '350000000000050' && soldEdit.status === 'Vendido', 'IMEI de aparelho vendido pode ser completado');

  console.log('\n--- Sincronização externa sem IMEI (usa external_id) ---');
  const sync = await DataService.syncExternalDevices([
    { external_id: 'EXT-A', model: 'iPhone 13', storage: '128GB', grade_id: gradeA.id },
    { external_id: 'EXT-B', model: 'iPhone 13', storage: '128GB', grade_id: gradeA.id },
    { model: 'iPhone 13', storage: '128GB' }
  ]);
  assert(sync.inserted_count === 2, '2 aparelhos externos sem IMEI inseridos (sem IMEI e sem id externo é ignorado)');
  const resync = await DataService.syncExternalDevices([{ external_id: 'EXT-A', model: 'iPhone 13', storage: '128GB', imei: '350000000000060' }]);
  assert(resync.updated_count === 1, 'Reenvio atualiza pelo external_id');

  console.log('\n================================================================');
  console.log(`🎉 TODOS OS ${totalTests} TESTES DE IMEI OPCIONAL FORAM APROVADOS! (${passedCount}/${totalTests})`);
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('Falha crítica:', err);
  process.exit(1);
});
