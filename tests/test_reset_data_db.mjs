// TESTE DE BANCO (PostgreSQL real via PGlite): botão "Zerar Base de Dados" (migration 019).
// Uso:  node tests/test_reset_data_db.mjs   (requer: npm i -D @electric-sql/pglite)
import { newDb, applyMigrationChain, readMigration, readConsolidated } from './helpers/pglite_setup.mjs';

let pass = 0;
let fail = 0;
const ok = (condition, message) => {
  if (condition) { pass++; console.log('  ✅', message); } else { fail++; console.log('  ❌', message); }
};
const throwsLike = async (fn, pattern, message) => {
  try { await fn(); ok(false, `${message} (não lançou erro)`); }
  catch (e) { ok(pattern.test(e.message), `${message} -> "${e.message.slice(0, 80)}"`); }
};

const OPERATIONAL = ['devices', 'stock_entries', 'stock_entry_items', 'stock_movements', 'stock_adjustments', 'retailers', 'orders',
  'order_items', 'order_device_allocations', 'payments', 'installments', 'commissions', 'retailer_referrals'];

async function scenario(label, db) {
  console.log(`\n===== ${label} =====`);
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];
  const n = async (t) => Number((await one(`SELECT count(*)::int c FROM ${t}`)).c);
  const reset = (confirmation = 'APAGAR TUDO') => q('SELECT rpc_reset_operational_data($1) AS r', [confirmation]);
  const setClaims = (claims) => db.exec(`SELECT set_config('request.jwt.claims', '${claims}', false)`);

  await db.exec(`CREATE SCHEMA IF NOT EXISTS auth; CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), email text);`);
  await db.exec(`INSERT INTO auth.users (email) VALUES ('Risemobile@gmail.com')`);
  const grade = (await q('SELECT id FROM grades LIMIT 1'))[0]?.id ?? (await one(`INSERT INTO grades (name) VALUES ('Z-RST') RETURNING id`)).id;
  const retailer = (await one(`INSERT INTO retailers (store_name, contact_name, whatsapp) VALUES ('Loja','C','1') RETURNING id`)).id;
  await q('SELECT rpc_create_stock_entry_batch_multi($1,$2,$3,$4,$5::jsonb)',
    ['L-RST', '', 'admin', 'manual', JSON.stringify([{ model: 'ZR-1', storage: '128GB', grade_id: grade, unit_cost_usd: '10', suggested_price_usd: '20', units: [{}, {}, {}, {}, {}] }])]);
  const order = (await one(`SELECT rpc_reserve_devices_for_order(NULL, $1::uuid, $2::jsonb, 't', $3) AS r`,
    [retailer, JSON.stringify([{ model: 'ZR-1', storage: '128GB', grade_id: grade, quantity: 2, unit_price_usd: 50 }]), `PED-${Math.random()}`])).r;
  await one(`SELECT rpc_finalize_order_sale($1::uuid, $2::jsonb, '[]'::jsonb) AS r`, [order.order_id || order.id, JSON.stringify([{ method: 'PIX', amount_usd: 100 }])]);
  const spare = (await one(`SELECT id FROM devices WHERE status='Disponível' LIMIT 1`)).id;
  await one(`SELECT rpc_adjust_device_stock($1::uuid, 'Defeito', 't') AS r`, [spare]);
  const agent = (await one(`INSERT INTO commission_agents (name, email) VALUES ('Agente','ag@x.com') RETURNING id`)).id;
  await q(`INSERT INTO retailer_referrals (agent_id, retailer_id, referrer_name) VALUES ($1,$2,'Ref')`, [agent, retailer]);

  const gradesBefore = await n('grades');
  const agentsBefore = await n('commission_agents');
  const settingsBefore = await n('settings');
  const devicesN = await n('devices');
  const ordersN = await n('orders');
  const paymentsN = await n('payments');
  ok(devicesN >= 5 && ordersN >= 1 && paymentsN >= 1 && await n('stock_adjustments') >= 1, 'cenário com estoque, venda, pagamento e ajuste');

  console.log('Permissões');
  const canExec = async (role) => (await one(`SELECT has_function_privilege($1, 'public.rpc_reset_operational_data(text)', 'EXECUTE') AS ok`, [role])).ok;
  ok((await canExec('anon')) === false, 'anon NÃO executa rpc_reset_operational_data');
  ok((await canExec('authenticated')) === true && (await canExec('service_role')) === true, 'authenticated e service_role executam');

  console.log('Falha fechada: sem controle de administradores (015) a função recusa');
  await throwsLike(() => reset(), /bloqueado.*migration 015/, 'sem is_admin() o reset é recusado');
  ok(await n('devices') === devicesN, 'nada foi apagado');

  console.log('Somente administrador');
  await db.exec(`CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT false $$;`);
  await setClaims('{"role":"authenticated","email":"quem@x.com"}');
  await throwsLike(() => reset(), /Apenas administradores/, 'usuário logado que não é administrador é bloqueado');
  ok(await n('devices') === devicesN && await n('orders') === ordersN, 'nada foi apagado');

  console.log('Confirmação digitada obrigatória');
  await db.exec(`CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true $$;`);
  await setClaims('{"role":"authenticated","email":"Risemobile@gmail.com"}');
  await throwsLike(() => reset(''), /Confirmação inválida/, 'confirmação vazia é recusada');
  await throwsLike(() => reset('apagar'), /Confirmação inválida/, 'confirmação errada é recusada');
  await throwsLike(() => reset(null), /Confirmação inválida/, 'confirmação ausente é recusada');
  ok(await n('devices') === devicesN && await n('orders') === ordersN && await n('stock_movements') > 0, 'nada foi apagado');

  console.log('Administrador com confirmação: zera estoque e vendas');
  const res = (await reset('  APAGAR TUDO  '))[0].r;
  ok(res.success === true && res.performed_by === 'Risemobile@gmail.com', 'retorna sucesso e o usuário vem do JWT');
  ok(res.deleted_counts.devices === devicesN && res.deleted_counts.orders === ordersN && res.deleted_counts.payments === paymentsN, 'retorna quantas linhas foram apagadas');
  for (const t of OPERATIONAL) ok(await n(t) === 0, `${t} = 0`);
  for (const t of ['sale_returns', 'sale_return_items']) {
    if ((await one('SELECT to_regclass($1) AS t', [`public.${t}`])).t) ok(await n(t) === 0, `${t} = 0`);
  }
  const logs = await q('SELECT action, performed_by, old_data FROM audit_logs');
  ok(logs.length === 1 && logs[0].action === 'DATA_RESET' && logs[0].performed_by === 'Risemobile@gmail.com', 'auditoria contém só o registro DATA_RESET com o usuário');
  ok(logs[0].old_data.devices === devicesN && logs[0].old_data.orders === ordersN, 'DATA_RESET guarda as contagens apagadas');

  console.log('O que deve ser mantido');
  ok(await n('grades') === gradesBefore && gradesBefore > 0, 'grades mantidas');
  ok(await n('settings') === settingsBefore, 'settings mantidas');
  ok(await n('commission_agents') === agentsBefore, 'comissionados mantidos');
  ok(await n('auth.users') === 1, 'logins mantidos');

  console.log('Base zerada continua utilizável');
  await q('SELECT rpc_create_stock_entry_batch_multi($1,$2,$3,$4,$5::jsonb)',
    ['L-RST2', '', 'admin', 'manual', JSON.stringify([{ model: 'ZR-2', storage: '64GB', grade_id: grade, units: [{}, {}] }])]);
  ok(await n('devices') === 2, 'nova entrada de estoque funciona após zerar');
  ok((await reset())[0].r.success === true && await n('devices') === 0, 'pode zerar de novo');

  console.log('service_role (chamada de backend)');
  await setClaims('{"role":"service_role","email":"robo@x.com"}');
  await db.exec(`CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT false $$;`);
  ok((await reset())[0].r.performed_by === 'robo@x.com', 'service_role passa mesmo sem ser admin; ainda exige confirmação');
  await throwsLike(() => reset('x'), /Confirmação inválida/, 'service_role também precisa da confirmação');
  await setClaims('');
  await db.exec('DROP FUNCTION public.is_admin();');
}

{
  const db = await newDb();
  await applyMigrationChain(db, ['017_optional_device_identifiers.sql', '018_soft_delete_devices.sql', '019_reset_operational_data.sql']);
  await db.exec(readMigration('019_reset_operational_data.sql'));
  // commission_agents / retailer_referrals vêm da migration 014 (depende do schema auth do Supabase)
  await db.exec(`CREATE SCHEMA IF NOT EXISTS auth;`);
  await db.exec(`CREATE TABLE IF NOT EXISTS public.commission_agents (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR NOT NULL, email VARCHAR NOT NULL);
    CREATE TABLE IF NOT EXISTS public.retailer_referrals (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), agent_id UUID REFERENCES public.commission_agents(id) ON DELETE SET NULL, retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT, referrer_name VARCHAR NOT NULL);`);
  await scenario('MIGRATIONS 001..013 + 017 + 018 + 019 (019 aplicada duas vezes)', db);
}
{
  const db = await newDb();
  await db.exec(readConsolidated());
  await scenario('consolidated_setup.sql (instalação limpa)', db);
}

console.log(`\nRESULTADO: ${pass} passou, ${fail} falhou`);
process.exit(fail ? 1 : 0);
