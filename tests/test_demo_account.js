// TESTE: conta demo com dados fictícios (motor local, sem tocar no Supabase)
import { DataService, isDemoMode, isLiveSupabaseConfigured } from '../src/lib/supabaseClient.js';
import { AuthService } from '../src/lib/authService.js';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/lib/demoData.js';

let passed = 0;
let total = 0;
function assert(condition, message) {
  total++;
  if (!condition) { console.error(`❌ FALHA: ${message}`); throw new Error(message); }
  passed++;
  console.log(`✅ APROVADO: ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('🎭 TESTE — CONTA DEMO COM DADOS FICTÍCIOS');
  console.log('================================================================');

  const wrong = await AuthService.signInWithPassword(DEMO_EMAIL, 'senha-errada');
  assert(!wrong.success && !isDemoMode(), 'senha errada não ativa o modo demo');

  const res = await AuthService.signInWithPassword(DEMO_EMAIL, DEMO_PASSWORD);
  assert(res.success && res.user.user_metadata.is_demo === true, 'login demo funciona e marca a sessão como demo');
  assert(isDemoMode() && isLiveSupabaseConfigured === false, 'modo demo desliga o Supabase');

  const [devices, retailers, orders, installments, movements, agents, referrals, adjustments, entries] = await Promise.all([
    DataService.getDevices(), DataService.getRetailers(), DataService.getOrders(), DataService.getInstallments(),
    DataService.getMovements(), DataService.getCommissionAgents(), DataService.getRetailerReferrals(),
    DataService.getAdjustments(), DataService.getStockEntries()
  ]);

  assert(entries.length === 4, `4 lotes de entrada (${entries.length})`);
  assert(retailers.length === 6 && agents.length === 3 && referrals.length === 4, 'lojistas, comissionados e indicações criados');
  assert(devices.length === 50, `50 aparelhos cadastrados (${devices.length})`);
  const ids = devices.map(d => d.id);
  assert(new Set(ids).size === ids.length, 'ids de aparelhos únicos');
  const imeis = devices.map(d => d.imei);
  assert(new Set(imeis).size === imeis.length && imeis.every(i => /^99\d{13}$/.test(i)), 'IMEIs fictícios únicos');
  const by = (s) => devices.filter(d => d.status === s).length;
  assert(by('Disponível') > 5 && by('Vendido') > 15 && by('Reservado') === 3 && by('Retirado por ajuste') === 1, `status variados (Disp ${by('Disponível')}, Vend ${by('Vendido')}, Res ${by('Reservado')})`);

  const statuses = new Set(orders.map(o => o.status));
  ['Finalizado', 'Parcialmente Devolvida', 'Reservado', 'Cancelado', 'Em Separação'].forEach(s =>
    assert(statuses.has(s) || (s === 'Em Separação' && orders.some(o => o.allocated_devices?.some(d => d.separated))), `há pedido com status ${s}`));
  assert(orders.length === 15, `15 pedidos (${orders.length})`);
  const orderIds = orders.map(o => o.id);
  assert(new Set(orderIds).size === orderIds.length, 'ids de pedidos únicos');
  assert(new Set(orders.map(o => o.order_number)).size === orders.length, 'números de pedido únicos');

  const iStat = (s) => installments.filter(i => i.status === s).length;
  assert(iStat('Pago') > 0 && iStat('Vencido') > 0 && iStat('A vencer') > 0, `parcelas pagas/vencidas/a vencer (${iStat('Pago')}/${iStat('Vencido')}/${iStat('A vencer')})`);
  assert(new Set(installments.map(i => i.id)).size === installments.length, 'ids de parcelas únicos');
  assert(adjustments.length === 1 && movements.length > 100, 'ajuste e movimentações registrados');

  const dates = orders.map(o => new Date(o.created_at).getTime());
  const spanDays = (Math.max(...dates) - Math.min(...dates)) / 86400000;
  assert(spanDays > 60, `pedidos espalhados no tempo (${spanDays.toFixed(0)} dias)`);
  assert(new Date().getFullYear() >= 2025 && Math.abs(Date.now() - new Date().getTime()) < 1000, 'relógio real restaurado após a semeadura');

  const paidOrders = orders.filter(o => o.status === 'Finalizado' || o.status === 'Parcialmente Devolvida');
  assert(paidOrders.every(o => o.paid_amount_usd <= o.total_amount_usd + 0.01 && o.total_profit_usd > 0), 'vendas com lucro positivo e sem pago > total');

  await AuthService.resetDemoData();
  assert((await DataService.getOrders()).length === 15, 'restaurar dados recria o mesmo conjunto (sem duplicar)');

  await AuthService.signOut();
  assert(!isDemoMode(), 'sair da conta demo volta ao modo normal');
  assert((await DataService.getOrders()).length === 0, 'dados demo não vazam para o modo normal');

  console.log('\n================================================================');
  console.log(`🎉 TODOS OS ${total} TESTES DA CONTA DEMO FORAM APROVADOS! (${passed}/${total})`);
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\n💥 TESTE FALHOU:', err.message);
  process.exit(1);
});
