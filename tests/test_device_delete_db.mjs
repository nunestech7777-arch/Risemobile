// TESTE DE BANCO (PostgreSQL real via PGlite): apagar aparelho do estoque (soft delete, migration 018).
// Uso:  node tests/test_device_delete_db.mjs   (requer: npm i -D @electric-sql/pglite)
import { newDb, applyMigrationChain, readMigration, readConsolidated } from './helpers/pglite_setup.mjs';

let pass = 0;
let fail = 0;
const ok = (condition, message) => {
  if (condition) { pass++; console.log('  ✅', message); } else { fail++; console.log('  ❌', message); }
};
const throwsLike = async (fn, pattern, message) => {
  try { await fn(); ok(false, `${message} (não lançou erro)`); }
  catch (e) { ok(pattern.test(e.message), `${message} -> "${e.message.slice(0, 70)}"`); }
};

const BLOCK_MSG = /possui vínculos com pedido, venda, reserva ou movimentações financeiras/;

async function scenario(label, db) {
  console.log(`\n===== ${label} =====`);
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];
  const grade = (await one(`INSERT INTO grades (name) VALUES ('Z-DEL') RETURNING id`)).id;
  const retailer = (await one(`INSERT INTO retailers (store_name, contact_name, whatsapp) VALUES ('Loja','C','1') RETURNING id`)).id;
  const entry = (model, units) => q(
    'SELECT rpc_create_stock_entry_batch_multi($1,$2,$3,$4,$5::jsonb) AS r',
    [`L-${Math.random()}`, '', 'admin', 'manual', JSON.stringify([{ model, storage: '128GB', grade_id: grade, units }])]
  );
  const del = (id, reason = 'Cadastro feito por engano', by = 'admin@teste.com') =>
    q('SELECT rpc_delete_device($1::uuid,$2,$3) AS r', [id, reason, by]);
  const idsOf = async (model) => (await q('SELECT id FROM devices WHERE model=$1 ORDER BY created_at, id', [model])).map(r => r.id);
  const reserve = (model, qty) => one(
    `SELECT rpc_reserve_devices_for_order(NULL, $1::uuid, $2::jsonb, 't', $3) AS r`,
    [retailer, JSON.stringify([{ model, storage: '128GB', grade_id: grade, quantity: qty, unit_price_usd: 500 }]), `PED-${Math.random()}`]
  );

  console.log('Testes 1-3: apagar aparelho disponível sem vínculos (sem IMEI / incompleto)');
  await entry('ZD-1', [{}, {}, {}]);
  const [a, b, c] = await idsOf('ZD-1');
  const r = (await del(a, 'Cadastro duplicado'))[0].r;
  ok(r.success === true, 'exclusão permitida (sem IMEI, sem cor, sem bateria)');
  const row = await one('SELECT * FROM devices WHERE id=$1', [a]);
  ok(row.status === 'Removido' && row.deleted_at && row.deleted_by === 'admin@teste.com' && row.deletion_reason === 'Cadastro duplicado',
    'soft delete: linha continua no banco com status Removido, deleted_at, deleted_by e deletion_reason');
  ok((await one('SELECT count(*)::int c FROM stock_movements WHERE device_id=$1', [a])).c === 1, 'histórico (movimentação de Entrada) preservado');

  console.log('Teste 9: auditoria');
  const audit = await one(`SELECT * FROM audit_logs WHERE action='DEVICE_SOFT_DELETED' AND record_id=$1`, [a]);
  ok(Boolean(audit), 'registro DEVICE_SOFT_DELETED criado');
  ok(audit.performed_by === 'admin@teste.com' && audit.created_at, 'auditoria com usuário e data/hora');
  ok(audit.new_data.deletion_reason === 'Cadastro duplicado' && audit.record_id === a, 'auditoria com motivo e device_id');
  ok(audit.old_data.model === 'ZD-1' && audit.old_data.storage === '128GB' && audit.old_data.grade === 'Z-DEL' && audit.old_data.status === 'Disponível' && 'imei' in audit.old_data,
    'auditoria guarda modelo, armazenamento, grade, IMEI e status anterior');

  console.log('Validações da RPC');
  await throwsLike(() => del(b, '   '), /motivo/i, 'motivo em branco é rejeitado');
  await throwsLike(() => del(b, null), /motivo/i, 'motivo ausente é rejeitado');
  await throwsLike(() => del(a), /já foi removido/, 'apagar de novo é rejeitado');
  await throwsLike(() => del('00000000-0000-0000-0000-000000000000'), /não encontrado/, 'aparelho inexistente é rejeitado');
  ok((await one('SELECT status FROM devices WHERE id=$1', [b])).status === 'Disponível', 'tentativas inválidas não alteram o aparelho');

  console.log('Testes 4-6 e 10: vínculos bloqueiam (direto via RPC/API)');
  await entry('ZD-2', [{}, {}, {}]);
  const order = (await reserve('ZD-2', 2)).r;
  const orderId = order.order_id || order.id;
  const allocated = (await q('SELECT device_id FROM order_device_allocations WHERE order_id=$1', [orderId])).map(x => x.device_id);
  await throwsLike(() => del(allocated[0]), BLOCK_MSG, 'aparelho Reservado (pedido ativo) é bloqueado');
  await one(`SELECT rpc_finalize_order_sale($1::uuid, $2::jsonb, '[]'::jsonb) AS r`, [orderId, JSON.stringify([{ method: 'PIX', amount_usd: 1000 }])]);
  await throwsLike(() => del(allocated[0]), BLOCK_MSG, 'aparelho Vendido é bloqueado');
  ok((await one('SELECT status FROM devices WHERE id=$1', [allocated[0]])).status === 'Vendido', 'aparelho vendido permanece intacto');
  ok(!(await one('SELECT 1 x FROM audit_logs WHERE action=$1 AND record_id=$2', ['DEVICE_SOFT_DELETED', allocated[0]])), 'bloqueio não gera auditoria de exclusão');

  const order2 = (await reserve('ZD-2', 1)).r;
  const id2 = order2.order_id || order2.id;
  const heldId = (await one('SELECT device_id FROM order_device_allocations WHERE order_id=$1', [id2])).device_id;
  await one(`SELECT rpc_cancel_order($1::uuid, 'teste') AS r`, [id2]);
  ok((await one('SELECT status FROM devices WHERE id=$1', [heldId])).status === 'Disponível', 'reserva cancelada devolve o aparelho a Disponível');
  await throwsLike(() => del(heldId), BLOCK_MSG, 'Disponível com histórico de reserva/cancelamento continua bloqueado (já teve vínculo comercial)');

  await entry('ZD-3', [{}]);
  const [adjId] = await idsOf('ZD-3');
  await one(`SELECT rpc_adjust_device_stock($1::uuid, 'Defeito', 'x') AS r`, [adjId]);
  await throwsLike(() => del(adjId), BLOCK_MSG, 'aparelho Retirado por ajuste é bloqueado');

  console.log('Testes 7-8: aparelho removido some do estoque operacional e da seleção automática');
  await entry('ZD-4', [{}, {}, {}]);
  const [d1, d2, d3] = await idsOf('ZD-4');
  await del(d1);
  ok((await one(`SELECT count(*)::int c FROM devices WHERE model='ZD-4' AND status='Disponível'`)).c === 2, 'estoque disponível passa de 3 para 2');
  await throwsLike(() => reserve('ZD-4', 3), /insuficiente/i, 'reservar 3 falha: o removido não pode ser selecionado');
  const okOrder = (await reserve('ZD-4', 2)).r;
  const picked = (await q('SELECT device_id FROM order_device_allocations WHERE order_id=$1', [okOrder.order_id || okOrder.id])).map(x => x.device_id);
  ok(picked.length === 2 && !picked.includes(d1) && picked.includes(d2) && picked.includes(d3), 'reserva de 2 usa somente os aparelhos não removidos');

  console.log('Integridade');
  await throwsLike(() => q(`UPDATE devices SET status='Removido' WHERE id=$1`, [b]), /devices_removed_consistency/, "status 'Removido' sem deleted_at é impossível");
  await throwsLike(() => q(`UPDATE devices SET status='Disponível' WHERE id=$1`, [a]), /devices_removed_consistency/, 'aparelho removido não volta a Disponível por UPDATE direto');

  console.log('IMEI de aparelho removido volta a ficar livre');
  await entry('ZD-5', [{ imei: 'IMEI-REUSO' }]);
  await throwsLike(() => entry('ZD-5B', [{ imei: 'imei-reuso' }]), /já está cadastrado/, 'IMEI de aparelho ativo continua bloqueado');
  const [imeiDev] = await idsOf('ZD-5');
  await del(imeiDev, 'Dados incorretos');
  await entry('ZD-5B', [{ imei: 'IMEI-REUSO' }]);
  ok((await q(`SELECT 1 FROM devices WHERE lower(imei)='imei-reuso'`)).length === 2, 'mesmo IMEI recadastrado após a remoção (1 removido + 1 ativo)');
  const audit2 = await one(`SELECT old_data FROM audit_logs WHERE action='DEVICE_SOFT_DELETED' AND record_id=$1`, [imeiDev]);
  ok(audit2.old_data.imei === 'IMEI-REUSO', 'auditoria guarda o IMEI do aparelho removido');

  console.log('Teste 10: permissões e papel de administrador');
  const canExec = async (role) => (await one(`SELECT has_function_privilege($1, 'public.rpc_delete_device(uuid,text,varchar)', 'EXECUTE') AS ok`, [role])).ok;
  ok((await canExec('anon')) === false, 'anon NÃO executa rpc_delete_device');
  ok((await canExec('authenticated')) === true && (await canExec('service_role')) === true, 'authenticated e service_role executam');

  await entry('ZD-6', [{}, {}, {}]);
  const [e1, e2, e3] = await idsOf('ZD-6');
  await db.exec(`CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT false $$;`);
  await throwsLike(() => del(e1), /Apenas administradores/, 'usuário logado que NÃO é administrador é bloqueado');
  await db.exec(`SELECT set_config('request.jwt.claims', '{"role":"service_role","email":"robo@x.com"}', false)`);
  const svc = (await del(e1))[0].r;
  ok(svc.deleted_by === 'robo@x.com', 'service_role passa; usuário auditado vem do JWT, não do parâmetro');
  await db.exec(`SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"quem@x.com"}', false)`);
  await throwsLike(() => del(e2), /Apenas administradores/, 'JWT authenticated sem ser admin continua bloqueado');
  await db.exec(`CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true $$;`);
  const adm = (await del(e2, 'Outro — teste', 'forjado@x.com'))[0].r;
  ok(adm.deleted_by === 'quem@x.com', 'administrador autenticado apaga; e-mail do parâmetro não sobrepõe o do JWT');
  await db.exec(`SELECT set_config('request.jwt.claims', '', false); DROP FUNCTION public.is_admin();`);
  ok((await del(e3))[0].r.success === true, 'sem controle de acesso da 015 instalado a RPC funciona (modo desenvolvimento)');
}

{
  const db = await newDb();
  await applyMigrationChain(db, ['017_optional_device_identifiers.sql', '018_soft_delete_devices.sql']);
  await db.exec(readMigration('018_soft_delete_devices.sql'));
  await scenario('MIGRATIONS 001..013 + 017 + 018 (018 aplicada duas vezes)', db);
}
{
  const db = await newDb();
  await db.exec(readConsolidated());
  await scenario('consolidated_setup.sql (instalação limpa)', db);
}

console.log(`\nRESULTADO: ${pass} passou, ${fail} falhou`);
process.exit(fail ? 1 : 0);
