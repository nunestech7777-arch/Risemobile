// TESTE: apagar aparelho do estoque (soft delete, motor local do DataService)
import { DataService, initStorageIfNeeded } from '../src/lib/supabaseClient.js';
import { DEVICE_DELETE_BLOCKED_MESSAGE, buildDeletionReason, getDeviceDeleteBlock, getDevicesWithCommercialHistory } from '../src/lib/deviceRules.js';

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
  console.log('🗑️  TESTE — APAGAR APARELHO DO ESTOQUE (SOFT DELETE)');
  console.log('================================================================');

  initStorageIfNeeded();
  const [grade] = await DataService.getGrades();
  const retailer = await DataService.saveRetailer({ store_name: 'Loja Exclusão', contact_name: 'T', whatsapp: '5511999990000', commission_per_unit_usd: 5 });
  const entry = (model, units, extra = {}) =>
    DataService.createStockEntryBatchMulti({ reference_code: `L-${model}`, notes: '' }, [{ model, storage: '128GB', grade_id: grade.id, units, ...extra }]);
  const byModel = async (model) => (await DataService.getDevices()).filter(d => d.model === model);
  const BLOCKED = /possui vínculos com pedido, venda, reserva ou movimentações financeiras/;

  console.log('\n--- Testes 1-3: apagar aparelho disponível sem vínculos ---');
  await entry('ZD-1', [{}, {}, {}]);
  const [a, b] = await byModel('ZD-1');
  const stockBefore = (await DataService.getDevices()).length;
  const res = await DataService.deleteDevice(a.id, 'Cadastro duplicado', 'admin@teste.com');
  assert(res.success === true, 'aparelho sem IMEI, cor e bateria pode ser apagado');
  assert((await DataService.getDevices()).length === stockBefore - 1, 'estoque operacional perde exatamente 1 aparelho');
  assert(!(await DataService.getDevices()).some(d => d.id === a.id), 'aparelho removido não aparece mais no estoque');
  const removed = (await DataService.getDeletedDevices()).find(d => d.id === a.id);
  assert(removed && removed.status === 'Removido' && removed.deleted_by === 'admin@teste.com' && removed.deletion_reason === 'Cadastro duplicado' && removed.deleted_at,
    'soft delete guarda status Removido, deleted_at, deleted_by e deletion_reason');
  assert(removed.model === 'ZD-1' && removed.imei === null, 'dados do aparelho preservados no registro removido');

  console.log('\n--- Teste 9: auditoria ---');
  const audit = (await DataService.getAuditLogs()).find(l => l.action === 'DEVICE_SOFT_DELETED' && l.record_id === a.id);
  assert(Boolean(audit), 'registro DEVICE_SOFT_DELETED criado');
  assert(audit.performed_by === 'admin@teste.com' && Boolean(audit.created_at), 'auditoria com usuário e data/hora');
  assert(audit.new_data.deletion_reason === 'Cadastro duplicado', 'auditoria com motivo');
  assert(audit.old_data.model === 'ZD-1' && audit.old_data.storage === '128GB' && audit.old_data.grade === grade.name && audit.old_data.status === 'Disponível' && 'imei' in audit.old_data,
    'auditoria guarda modelo, armazenamento, grade, IMEI e status anterior');

  console.log('\n--- Validações ---');
  await rejects(() => DataService.deleteDevice(b.id, '   '), /motivo/i, 'motivo em branco é rejeitado');
  await rejects(() => DataService.deleteDevice(b.id, ''), /motivo/i, 'motivo vazio é rejeitado');
  await rejects(() => DataService.deleteDevice(a.id, 'x'), /já foi removido/, 'apagar de novo é rejeitado');
  await rejects(() => DataService.deleteDevice('nao-existe', 'x'), /não encontrado/, 'aparelho inexistente é rejeitado');
  assert((await byModel('ZD-1')).some(d => d.id === b.id), 'tentativas inválidas não removem nada');

  console.log('\n--- Testes 4-6: vínculos bloqueiam a exclusão ---');
  await entry('ZD-2', [{}, {}, {}]);
  const order = await DataService.reserveOrder({ retailer_id: retailer.id, notes: 'x' }, [{ model: 'ZD-2', storage: '128GB', grade_id: grade.id, quantity: 2, unit_price_usd: 500 }]);
  const [reservedId, otherReservedId] = order.allocated_devices.map(d => d.device_id);
  await rejects(() => DataService.deleteDevice(reservedId, 'x'), BLOCKED, 'aparelho Reservado (pedido ativo) é bloqueado');
  await DataService.finalizeOrderSale(order.id, [{ amount_usd: 1000, method: 'PIX' }], []);
  await rejects(() => DataService.deleteDevice(reservedId, 'x'), BLOCKED, 'aparelho Vendido é bloqueado');
  const sold = (await DataService.getDevices()).find(d => d.id === reservedId);
  assert(sold.status === 'Vendido', 'aparelho vendido continua intacto no estoque');

  const order2 = await DataService.reserveOrder({ retailer_id: retailer.id, notes: 'y' }, [{ model: 'ZD-2', storage: '128GB', grade_id: grade.id, quantity: 1, unit_price_usd: 500 }]);
  const heldId = order2.allocated_devices[0].device_id;
  await DataService.cancelOrder(order2.id, 'teste');
  assert((await DataService.getDevices()).find(d => d.id === heldId).status === 'Disponível', 'reserva cancelada devolve o aparelho a Disponível');
  await rejects(() => DataService.deleteDevice(heldId, 'x'), BLOCKED, 'Disponível com histórico de reserva/cancelamento continua bloqueado');

  await entry('ZD-3', [{}]);
  const [adjustId] = (await byModel('ZD-3')).map(d => d.id);
  await DataService.adjustStock(adjustId, 'Defeito', 'teste');
  await rejects(() => DataService.deleteDevice(adjustId, 'x'), BLOCKED, 'aparelho Retirado por ajuste é bloqueado');
  assert(!(await DataService.getAuditLogs()).some(l => l.action === 'DEVICE_SOFT_DELETED' && [reservedId, otherReservedId, heldId, adjustId].includes(l.record_id)),
    'tentativas bloqueadas não geram auditoria de exclusão');

  console.log('\n--- Testes 7-8: removido some do estoque e da seleção automática ---');
  await entry('ZD-4', [{}, {}, {}]);
  const [d1, d2, d3] = (await byModel('ZD-4')).map(d => d.id);
  await DataService.deleteDevice(d1, 'Dados incorretos');
  assert((await byModel('ZD-4')).length === 2, 'estoque de ZD-4 passa de 3 para 2');
  await rejects(
    () => DataService.reserveOrder({ retailer_id: retailer.id, notes: 'z' }, [{ model: 'ZD-4', storage: '128GB', grade_id: grade.id, quantity: 3, unit_price_usd: 500 }]),
    /insuficiente/i, 'reservar 3 falha: o removido não pode ser selecionado'
  );
  const ok2 = await DataService.reserveOrder({ retailer_id: retailer.id, notes: 'z' }, [{ model: 'ZD-4', storage: '128GB', grade_id: grade.id, quantity: 2, unit_price_usd: 500 }]);
  const picked = ok2.allocated_devices.map(d => d.device_id);
  assert(picked.length === 2 && !picked.includes(d1) && picked.includes(d2) && picked.includes(d3), 'reserva de 2 usa só os aparelhos não removidos');

  console.log('\n--- IMEI de aparelho removido volta a ficar livre ---');
  await entry('ZD-5', [{ imei: 'IMEI-REUSO' }]);
  await rejects(() => entry('ZD-5B', [{ imei: 'imei-reuso' }]), /já está cadastrado/, 'IMEI de aparelho ativo continua bloqueado');
  await DataService.deleteDevice((await byModel('ZD-5'))[0].id, 'Cadastro feito por engano');
  await entry('ZD-5B', [{ imei: 'IMEI-REUSO' }]);
  assert((await byModel('ZD-5B')).length === 1, 'mesmo IMEI recadastrado após a remoção');

  console.log('\n--- Regras compartilhadas da interface ---');
  assert(buildDeletionReason('Cadastro duplicado') === 'Cadastro duplicado', 'motivo simples');
  assert(buildDeletionReason('Outro', '  ') === '' && buildDeletionReason('') === '', "'Outro' sem descrição e motivo vazio são inválidos");
  assert(buildDeletionReason('Outro', 'lote errado') === 'Outro — lote errado', "'Outro' com descrição");
  const ids = getDevicesWithCommercialHistory([{ device_id: 'x', movement_type: 'Entrada' }, { device_id: 'y', movement_type: 'Reserva' }]);
  assert(getDeviceDeleteBlock({ id: 'x', status: 'Disponível' }, ids) === null, 'só Entrada: exclusão liberada na tela');
  assert(/já teve reserva/.test(getDeviceDeleteBlock({ id: 'y', status: 'Disponível' }, ids)), 'histórico comercial: bloqueado na tela');
  assert(/Vendido/.test(getDeviceDeleteBlock({ id: 'z', status: 'Vendido' }, ids)), 'status diferente de Disponível: bloqueado na tela');
  assert(DEVICE_DELETE_BLOCKED_MESSAGE.startsWith('Este aparelho possui vínculos com pedido, venda, reserva ou movimentações financeiras.'), 'mensagem de bloqueio padronizada');

  DataService.clearAllOperationalData();
  assert((await DataService.getDeletedDevices()).length === 0, 'limpeza de dados operacionais também limpa os removidos');

  console.log('\n================================================================');
  console.log(`🎉 TODOS OS ${totalTests} TESTES DE EXCLUSÃO DE APARELHO FORAM APROVADOS! (${passedCount}/${totalTests})`);
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('Falha crítica:', err);
  process.exit(1);
});
