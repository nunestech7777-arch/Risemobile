// TESTE: botão "Zerar Base de Dados" (motor local do DataService)
import { DataService, initStorageIfNeeded, RESET_CONFIRMATION_TEXT } from '../src/lib/supabaseClient.js';

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
  assert(error && pattern.test(error.message), `${message} (${error ? error.message.slice(0, 70) : 'não lançou erro'})`);
}

async function run() {
  console.log('================================================================');
  console.log('🧹 TESTE — ZERAR BASE DE DADOS (ESTOQUE E VENDAS)');
  console.log('================================================================');

  initStorageIfNeeded();
  const grades = await DataService.getGrades();
  const retailer = await DataService.saveRetailer({ store_name: 'Loja Reset', contact_name: 'T', whatsapp: '5511999990000', commission_per_unit_usd: 5 });
  await DataService.createStockEntryBatchMulti({ reference_code: 'L-RESET', notes: '' },
    [{ model: 'ZRST', storage: '128GB', grade_id: grades[0].id, unit_cost_usd: '300', suggested_price_usd: '400', units: [{}, {}, {}, {}] }]);
  const [spare] = (await DataService.getDevices()).filter(d => d.model === 'ZRST');
  await DataService.deleteDevice(spare.id, 'Cadastro duplicado', 'admin');
  const order = await DataService.reserveOrder(
    { retailer_id: retailer.id, notes: 'reset' },
    [{ model: 'ZRST', storage: '128GB', grade_id: grades[0].id, quantity: 2, unit_price_usd: 400 }]
  );
  await DataService.finalizeOrderSale(order.id, [{ amount_usd: 800, method: 'PIX' }], []);

  assert((await DataService.getOrders()).length === 1, 'existe uma venda finalizada antes do reset');
  const devicesBefore = (await DataService.getDevices()).length;
  assert(devicesBefore > 0, `base populada com aparelhos (${devicesBefore})`);
  assert((await DataService.getDeletedDevices()).length === 1, 'existe um aparelho removido antes do reset');
  assert((await DataService.getRetailers()).some(r => r.id === retailer.id), 'existe lojista antes do reset');

  console.log('\n--- Confirmação digitada obrigatória ---');
  assert(RESET_CONFIRMATION_TEXT === 'APAGAR TUDO', 'texto de confirmação é APAGAR TUDO');
  await rejects(() => DataService.resetOperationalData(''), /Confirmação inválida/, 'confirmação vazia é recusada');
  await rejects(() => DataService.resetOperationalData('apagar'), /Confirmação inválida/, 'confirmação errada é recusada');
  await rejects(() => DataService.resetOperationalData(undefined), /Confirmação inválida/, 'confirmação ausente é recusada');
  assert((await DataService.getDevices()).length === devicesBefore, 'nada foi apagado sem confirmação correta');

  console.log('\n--- Zerar estoque e vendas ---');
  const res = await DataService.resetOperationalData('  APAGAR TUDO ', 'admin@teste.com');
  assert(res.success === true && res.performed_by === 'admin@teste.com', 'retorna sucesso e o usuário');
  assert((await DataService.getDevices()).length === 0, 'estoque zerado');
  assert((await DataService.getDeletedDevices()).length === 0, 'aparelhos removidos também zerados');
  assert((await DataService.getOrders()).length === 0, 'vendas e pedidos zerados');
  assert((await DataService.getRetailers()).length === 0, 'lojistas zerados');
  assert((await DataService.getInstallments()).length === 0, 'parcelas zeradas');
  assert((await DataService.getMovements()).length === 0, 'movimentações zeradas');
  assert((await DataService.getStockEntries()).length === 0, 'entradas de estoque zeradas');
  const logs = await DataService.getAuditLogs();
  assert(logs.length === 1 && logs[0].action === 'DATA_RESET' && logs[0].performed_by === 'admin@teste.com', 'auditoria contém só o registro DATA_RESET');

  console.log('\n--- O que deve ser mantido ---');
  assert((await DataService.getGrades()).length === grades.length, 'grades mantidas');

  console.log('\n--- Base zerada continua utilizável ---');
  await DataService.createStockEntryBatchMulti({ reference_code: 'L-RESET-2', notes: '' },
    [{ model: 'ZRST2', storage: '64GB', grade_id: grades[0].id, units: [{}, {}] }]);
  assert((await DataService.getDevices()).length === 2, 'nova entrada de estoque funciona após zerar');

  console.log('\n================================================================');
  console.log(`🎉 TODOS OS ${totalTests} TESTES DE ZERAR BASE FORAM APROVADOS! (${passedCount}/${totalTests})`);
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\n💥 TESTE FALHOU:', err.message);
  process.exit(1);
});
