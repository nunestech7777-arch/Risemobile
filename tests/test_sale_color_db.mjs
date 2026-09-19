// TESTE DE BANCO (PostgreSQL real via PGlite): escolher a COR do aparelho na venda (migration 020).
// Uso:  node tests/test_sale_color_db.mjs   (requer: npm i -D @electric-sql/pglite)
import { newDb, applyMigrationChain, readMigration, readConsolidated } from './helpers/pglite_setup.mjs';

let pass = 0;
let fail = 0;
const ok = (condition, message) => {
  if (condition) { pass++; console.log('  ✅', message); } else { fail++; console.log('  ❌', message); }
};
const throwsLike = async (fn, pattern, message) => {
  try { await fn(); ok(false, `${message} (não lançou erro)`); }
  catch (e) { ok(pattern.test(e.message), `${message} -> "${e.message.slice(0, 90)}"`); }
};

async function scenario(label, db) {
  console.log(`\n===== ${label} =====`);
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];

  const grade = (await one(`INSERT INTO grades (name) VALUES ('Z-COR') RETURNING id`)).id;
  const retailer = (await one(`INSERT INTO retailers (store_name, contact_name, whatsapp) VALUES ('Loja','C','1') RETURNING id`)).id;
  const entry = (model, units) => q(
    'SELECT rpc_create_stock_entry_batch_multi($1,$2,$3,$4,$5::jsonb) AS r',
    [`L-${Math.random()}`, '', 'admin', 'manual', JSON.stringify([{ model, storage: '128GB', grade_id: grade, units }])]
  );
  const reserve = async (items) => (await one(
    `SELECT rpc_reserve_devices_for_order(NULL, $1::uuid, $2::jsonb, 't', $3) AS r`,
    [retailer, JSON.stringify(items), `PED-${Math.random()}`]
  )).r;
  const item = (model, quantity, extra = {}) => ({ model, storage: '128GB', grade_id: grade, quantity, unit_price_usd: 400, ...extra });
  const colorsOf = async (orderId) => (await q(
    `SELECT d.color FROM order_device_allocations oda JOIN devices d ON d.id = oda.device_id WHERE oda.order_id = $1 ORDER BY d.color`, [orderId]
  )).map(r => r.color);
  const statusCount = async (model, status) =>
    (await one(`SELECT count(*)::int c FROM devices WHERE model = $1 AND status = $2`, [model, status])).c;

  console.log('Reserva por cor');
  await entry('ZC-1', [
    { color: 'Branco', battery_health: 90 }, { color: 'Branco', battery_health: 91 }, { color: 'Branco', battery_health: 92 },
    { color: 'Preto', battery_health: 99 }, { color: 'Preto', battery_health: 98 },
    { battery_health: 100 }, {}
  ]);
  const r1 = await reserve([item('ZC-1', 2, { color: 'Branco' })]);
  ok((await colorsOf(r1.id)).join() === 'Branco,Branco', 'item com cor Branco reserva apenas aparelhos Brancos');
  ok(r1.allocated_devices.every(d => d.color === 'Branco'), 'retorno da função lista só aparelhos Brancos');
  ok((await one(`SELECT color FROM order_items WHERE order_id=$1`, [r1.id])).color === 'Branco', 'order_items guarda a cor pedida');
  ok(await statusCount('ZC-1', 'Reservado') === 2, 'somente 2 aparelhos ficaram Reservados');
  const best = (await q(`SELECT battery_health FROM devices WHERE id IN (SELECT device_id FROM order_device_allocations WHERE order_id=$1) ORDER BY battery_health DESC`, [r1.id])).map(r => r.battery_health);
  ok(best.join() === '92,91', 'dentro da cor, escolhe as de maior saúde de bateria');

  console.log('Cor sem diferenciar maiúsculas/espaços');
  const r2 = await reserve([item('ZC-1', 1, { color: '  pReTo ' })]);
  ok((await colorsOf(r2.id)).join() === 'Preto', '"  pReTo " reserva aparelho Preto');

  console.log('Estoque insuficiente na cor recusa tudo');
  const before = await statusCount('ZC-1', 'Reservado');
  const ordersBefore = (await one('SELECT count(*)::int c FROM orders')).c;
  await throwsLike(() => reserve([item('ZC-1', 1, { color: 'Branco' }), item('ZC-1', 2, { color: 'Preto' })]), /Estoque insuficiente.*Preto/, 'pede 2 Pretos com 1 restante -> erro cita a cor');
  ok(await statusCount('ZC-1', 'Reservado') === before, 'nenhum aparelho mudou de status (reserva atômica)');
  ok((await one('SELECT count(*)::int c FROM orders')).c === ordersBefore, 'nenhum pedido criado');
  await throwsLike(() => reserve([item('ZC-1', 1, { color: 'Amarelo' })]), /Estoque insuficiente.*Amarelo/, 'cor inexistente em estoque é recusada');

  console.log('Sem cor = qualquer cor (comportamento de sempre)');
  await entry('ZC-2', [{ color: 'Azul', battery_health: 80 }, { color: 'Rosa', battery_health: 95 }, { battery_health: 70 }]);
  const r3 = await reserve([item('ZC-2', 2)]);
  ok(r3.allocated_devices.length === 2 && (await colorsOf(r3.id)).includes('Rosa'), 'sem cor escolhe as de maior bateria de qualquer cor');
  ok((await one(`SELECT color FROM order_items WHERE order_id=$1`, [r3.id])).color === null, 'order_items.color fica vazio');
  const r3b = await reserve([item('ZC-2', 1, { color: '' })]);
  ok(r3b.allocated_devices.length === 1, 'cor "" (string vazia) equivale a qualquer cor');
  await entry('ZC-3', [{}, {}]);
  ok((await reserve([item('ZC-3', 2)])).allocated_devices.length === 2, 'aparelhos sem cor cadastrada continuam vendáveis por "qualquer cor"');
  await throwsLike(() => reserve([item('ZC-3', 1, { color: 'Preto' })]), /Estoque insuficiente/, 'aparelho sem cor não atende pedido de cor específica');

  console.log('Item com cor é atendido antes do "qualquer cor"');
  await entry('ZC-4', [
    { color: 'Branco', battery_health: 100 }, { color: 'Branco', battery_health: 100 }, { color: 'Branco', battery_health: 100 },
    { color: 'Preto', battery_health: 80 }, { color: 'Preto', battery_health: 80 }
  ]);
  const r4 = await reserve([item('ZC-4', 4), item('ZC-4', 1, { color: 'Branco' })]);
  ok(r4.allocated_devices.length === 5, 'qualquer-cor listado primeiro não rouba o Branco pedido (5 aparelhos reservados)');
  ok(await statusCount('ZC-4', 'Disponível') === 0, 'todo o estoque do modelo foi reservado');

  console.log('Aparelho removido nunca é reservado');
  if ((await one(`SELECT to_regclass('public.devices') AS t`)).t && (await q(`SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='deleted_at'`)).length) {
    await entry('ZC-5', [{ color: 'Verde' }, { color: 'Verde' }]);
    const [d1] = (await q(`SELECT id FROM devices WHERE model='ZC-5' ORDER BY id`)).map(r => r.id);
    await q('SELECT rpc_delete_device($1::uuid, $2, $3)', [d1, 'Cadastro duplicado', 'admin']);
    await throwsLike(() => reserve([item('ZC-5', 2, { color: 'Verde' })]), /Estoque insuficiente/, 'com 1 Verde removido só resta 1: pedir 2 falha');
    ok((await reserve([item('ZC-5', 1, { color: 'Verde' })])).allocated_devices.length === 1, 'o Verde restante ainda pode ser reservado');
  }

  if ((await one(`SELECT to_regclass('public.sale_returns') AS t`)).t) {
  console.log('Devolução usa o preço da linha da cor do aparelho');
  await entry('ZC-6', [{ color: 'Branco' }, { color: 'Branco' }, { color: 'Preto' }, { color: 'Preto' }]);
  const r6 = await reserve([item('ZC-6', 2, { color: 'Branco', unit_price_usd: 440 }), item('ZC-6', 2, { color: 'Preto', unit_price_usd: 470 })]);
  await one(`SELECT rpc_finalize_order_sale($1::uuid, $2::jsonb, '[]'::jsonb) AS r`, [r6.id, JSON.stringify([{ method: 'PIX', amount_usd: 1820 }])]);
  const preto = (await one(`SELECT d.id FROM order_device_allocations oda JOIN devices d ON d.id=oda.device_id WHERE oda.order_id=$1 AND d.color='Preto' LIMIT 1`, [r6.id])).id;
  const branco = (await one(`SELECT d.id FROM order_device_allocations oda JOIN devices d ON d.id=oda.device_id WHERE oda.order_id=$1 AND d.color='Branco' LIMIT 1`, [r6.id])).id;
  await one(`SELECT rpc_register_sale_return($1::uuid, ARRAY[$2]::uuid[], 'Defeito', '', 'admin') AS r`, [r6.id, preto]);
  await one(`SELECT rpc_register_sale_return($1::uuid, ARRAY[$2]::uuid[], 'Defeito', '', 'admin') AS r`, [r6.id, branco]);
  const priceOf = async (deviceId) => Number((await one('SELECT original_sale_price_usd p FROM sale_return_items WHERE device_id=$1', [deviceId])).p);
  ok(await priceOf(preto) === 470, 'devolver o Preto credita 470 (preço da linha Preto)');
  ok(await priceOf(branco) === 440, 'devolver o Branco credita 440 (preço da linha Branco)');
  }

  console.log('Permissões preservadas');
  const canExec = async (role) => (await one(`SELECT has_function_privilege($1, 'public.rpc_reserve_devices_for_order(uuid,uuid,jsonb,text,varchar)', 'EXECUTE') AS ok`, [role])).ok;
  ok((await canExec('authenticated')) === true && (await canExec('service_role')) === true, 'authenticated e service_role continuam executando a reserva');
}

{
  const db = await newDb();
  await applyMigrationChain(db, ['017_optional_device_identifiers.sql', '018_soft_delete_devices.sql', '020_sale_color_selection.sql']);
  await db.exec(readMigration('020_sale_color_selection.sql'));
  await scenario('MIGRATIONS 001..013 + 017 + 018 + 020 (020 aplicada duas vezes)', db);
}
{
  const db = await newDb();
  await db.exec(readConsolidated());
  await scenario('consolidated_setup.sql (instalação limpa)', db);
}

console.log(`\nRESULTADO: ${pass} passou, ${fail} falhou`);
process.exit(fail ? 1 : 0);
