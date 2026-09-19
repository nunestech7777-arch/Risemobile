// TESTE DE BANCO (PostgreSQL real via PGlite): IMEI/Serial opcional, único apenas quando informado.
// Valida a migration 017 (aplicada sobre 001..013) e o consolidated_setup.sql (instalação limpa).
//
// Requer a dependência de desenvolvimento opcional:  npm i -D @electric-sql/pglite
// Uso:  node tests/test_optional_imei_db.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let PGlite, uuid_ossp;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
  ({ uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp'));
} catch {
  console.log('⚠️  @electric-sql/pglite não instalado — teste de banco ignorado. Rode: npm i -D @electric-sql/pglite');
  process.exit(0);
}

const SUPABASE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../supabase');
const MIGRATIONS = path.join(SUPABASE_DIR, 'migrations');

let pass = 0;
let fail = 0;
const ok = (condition, message) => {
  if (condition) { pass++; console.log('  ✅', message); } else { fail++; console.log('  ❌', message); }
};
const throwsLike = async (fn, pattern, message) => {
  try { await fn(); ok(false, `${message} (não lançou erro)`); }
  catch (e) { ok(pattern.test(e.message), `${message} -> "${e.message.slice(0, 80)}"`); }
};

const newDb = async () => {
  const db = new PGlite({ extensions: { uuid_ossp } });
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  return db;
};

// A migration 007 faz GRANT em uma assinatura de 3 argumentos que nunca existiu; ignoramos só isso.
const readMigration = (file) => {
  const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
  return file.startsWith('007')
    ? sql.replace(/GRANT EXECUTE ON FUNCTION public\.rpc_sync_external_devices\(JSONB, VARCHAR, VARCHAR\)[^;]*;/, '')
    : sql;
};

async function scenario(label, db) {
  console.log(`\n===== ${label} =====`);
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];
  const hasTable = async (name) => Boolean((await one('SELECT to_regclass($1) AS t', [`public.${name}`])).t);

  const grade = (await one(`INSERT INTO grades (name) VALUES ('Z-TESTE') RETURNING id`)).id;
  const entry = (items) => q(
    'SELECT rpc_create_stock_entry_batch_multi($1,$2,$3,$4,$5::jsonb) AS r',
    [`L-${Math.random()}`, '', 'admin', 'manual', JSON.stringify(items)]
  );
  const units = (n) => Array.from({ length: n }, () => ({ imei: '', color: '', battery_health: '' }));
  const cfg = (model, extra) => ({ model, storage: '128GB', grade_id: grade, ...extra });
  const devicesOf = (model) => q('SELECT * FROM devices WHERE model = $1', [model]);

  console.log('Teste 1: só modelo + armazenamento + grade + quantidade');
  const r1 = (await entry([cfg('ZT-1', { unit_cost_usd: '350', suggested_price_usd: '430', units: units(10) })]))[0].r;
  const d1 = await devicesOf('ZT-1');
  ok(r1.total_quantity === 10 && d1.length === 10, '10 unidades criadas');
  ok(d1.every(d => d.status === 'Disponível'), 'todas Disponível');
  ok(d1.every(d => d.imei === null && d.color === null && d.battery_health === null), 'imei/cor/bateria = NULL (nada inventado)');
  ok(d1.every(d => Number(d.cost_price_usd) === 350 && Number(d.suggested_price_usd) === 430), 'herdam custo e preço padrão');
  ok((await one(`SELECT count(*)::int c FROM stock_movements sm JOIN devices d ON d.id = sm.device_id WHERE d.model='ZT-1' AND sm.movement_type='Entrada'`)).c === 10, 'movimentação de Entrada por device_id');

  console.log('Teste 1b: sem custo e preço');
  await entry([cfg('ZT-1B', { units: [{}, {}, {}] })]);
  ok((await devicesOf('ZT-1B')).every(d => Number(d.cost_price_usd) === 0 && Number(d.suggested_price_usd) === 0), '3 unidades com custo/preço 0');

  console.log('Testes 2/3/6/7: IMEI ausente, "", espaços, null; sem cor; sem bateria');
  await entry([cfg('ZT-2', { units: [{ imei: '' }, { imei: '   ' }, { imei: null }, {}, { color: null, battery_health: null }] })]);
  ok((await devicesOf('ZT-2')).length === 5, '5 aparelhos sem IMEI aceitos');

  console.log('Testes 4/5: IMEI/Serial informado é único');
  await entry([cfg('ZT-4', { units: [{ imei: '350000000000001' }, { imei: 'SN-ABC' }] })]);
  await throwsLike(() => entry([cfg('ZT-4B', { units: [{ imei: '350000000000001' }] })]), /já está cadastrado/, 'IMEI existente bloqueado (RPC)');
  await throwsLike(() => entry([cfg('ZT-4B', { units: [{ imei: 'sn-abc' }] })]), /já está cadastrado/, 'serial existente bloqueado (RPC, sem diferenciar maiúsculas)');
  await throwsLike(() => entry([cfg('ZT-4B', { units: [{ imei: 'X1' }, { imei: 'x1' }] })]), /duplicado/, 'IMEI repetido no lote bloqueado');
  ok((await devicesOf('ZT-4B')).length === 0, 'lote bloqueado não deixa entrada parcial');
  await throwsLike(() => q(`INSERT INTO devices (model,storage,grade_id,imei) VALUES ('ZT-4C','1',$1,'SN-ABC')`, [grade]), /unique_devices_imei_when_present/, 'índice parcial bloqueia duplicidade direto no banco');
  await q(`INSERT INTO devices (model,storage,grade_id,imei) VALUES ('ZT-4C','1',$1,''),('ZT-4C','1',$1,'  '),('ZT-4C','1',$1,NULL)`, [grade]);
  ok((await q(`SELECT 1 FROM devices WHERE model='ZT-4C' AND imei = ''`)).length === 0, 'string vazia vira NULL (vários permitidos)');
  await throwsLike(() => q(`UPDATE devices SET imei='SN-ABC' WHERE model='ZT-4C' AND imei IS NULL`), /unique/i, 'UPDATE para IMEI de outro aparelho bloqueado');
  ok((await one(`SELECT count(*)::int c FROM pg_constraint WHERE conrelid='public.devices'::regclass AND contype='u'`)).c === 0, 'sem UNIQUE simples em devices');
  ok((await one(`SELECT is_nullable FROM information_schema.columns WHERE table_name='devices' AND column_name='imei'`)).is_nullable === 'YES', 'devices.imei aceita NULL');

  console.log('Lote legado (rpc_create_stock_entry_batch)');
  const legacy = (await q(
    `SELECT rpc_create_stock_entry_batch('LEG','ZT-LEG','64GB',$1::uuid,4,300,380,'','admin','manual',$2::jsonb) AS r`,
    [grade, JSON.stringify([{}, {}, { imei: 'LEG-1' }, { imei: '' }])]
  ))[0].r;
  ok(legacy.quantity === 4, '4 unidades, apenas 1 com IMEI');
  await throwsLike(() => q(`SELECT rpc_create_stock_entry_batch('LEG2','ZT-LEG','64GB',$1::uuid,1,300,380,'','admin','manual',$2::jsonb)`, [grade, JSON.stringify([{ imei: 'LEG-1' }])]), /já está cadastrado/, 'legado bloqueia IMEI duplicado');

  console.log('Testes 8/9: reserva e venda sem IMEI');
  const retailer = (await one(`INSERT INTO retailers (store_name, contact_name, whatsapp) VALUES ('Loja','Contato','1') RETURNING id`)).id;
  await entry([cfg('ZT-SALE', { units: units(3) })]);
  const order = (await one(
    `SELECT rpc_reserve_devices_for_order(NULL, $1::uuid, $2::jsonb, 'teste', 'admin') AS r`,
    [retailer, JSON.stringify([{ model: 'ZT-SALE', storage: '128GB', grade_id: grade, quantity: 2, unit_price_usd: 500 }])]
  )).r;
  const orderId = order.order_id || order.id;
  ok(Boolean(orderId), 'reserva de 2 aparelhos sem IMEI/bateria/cor');
  ok((await one('SELECT count(*)::int c FROM order_device_allocations WHERE order_id=$1', [orderId])).c === 2, 'alocação por device_id');
  await one(`SELECT rpc_finalize_order_sale($1::uuid, $2::jsonb, '[]'::jsonb) AS r`, [orderId, JSON.stringify([{ method: 'PIX', amount_usd: 1000 }])]);
  ok((await q(`SELECT 1 FROM devices WHERE model='ZT-SALE' AND status='Vendido' AND imei IS NULL`)).length === 2, 'venda finalizada: 2 aparelhos sem IMEI ficaram Vendido');

  if (await hasTable('sale_returns')) {
    console.log('Devolução de aparelho vendido sem IMEI');
    const soldId = (await one('SELECT device_id FROM order_device_allocations WHERE order_id=$1 LIMIT 1', [orderId])).device_id;
    await one(`SELECT rpc_register_sale_return($1::uuid, ARRAY[$2]::uuid[], 'Defeito', '', 'admin') AS r`, [orderId, soldId]);
    ok((await one('SELECT status FROM devices WHERE id=$1', [soldId])).status === 'Disponível', 'devolução registrada e aparelho voltou a Disponível');
  }

  console.log('Ajuste de estoque sem IMEI');
  const adjustId = (await one(`SELECT id FROM devices WHERE model='ZT-SALE' AND status='Disponível' LIMIT 1`)).id;
  await one(`SELECT rpc_adjust_device_stock($1::uuid, 'Defeito', 'teste') AS r`, [adjustId]);
  ok((await one('SELECT status FROM devices WHERE id=$1', [adjustId])).status === 'Retirado por ajuste', 'ajuste sem IMEI');

  console.log('Sincronização externa sem IMEI');
  const sync = (await one(`SELECT rpc_sync_external_devices($1::jsonb, 'ERP') AS r`, [JSON.stringify([
    { external_id: 'E-1', model: 'ZT-EXT', storage: '128GB', grade_id: grade },
    { external_id: 'E-2', model: 'ZT-EXT', storage: '128GB', grade_id: grade },
    { model: 'ZT-EXT', storage: '128GB' }
  ])])).r;
  ok(sync.inserted_count === 2, 'externos sem IMEI entram pelo external_id');
}

// 1) Cadeia de migrations 001..013 + 017 (e reaplicação para provar idempotência)
{
  const db = await newDb();
  const files = fs.readdirSync(MIGRATIONS)
    .filter(f => /^(00[1-9]|01[0-3]|017)_/.test(f) && f !== '002_rls_policies.sql' && f !== '004_seed_demo_data.sql')
    .sort();
  for (const file of files) await db.exec(readMigration(file));
  await db.exec(readMigration('017_optional_device_identifiers.sql'));
  await scenario('MIGRATIONS 001..013 + 017 (017 aplicada duas vezes)', db);
}

// 2) Instalação limpa pelo consolidated_setup.sql
{
  const db = await newDb();
  await db.exec(fs.readFileSync(path.join(SUPABASE_DIR, 'consolidated_setup.sql'), 'utf8'));
  await scenario('consolidated_setup.sql (instalação limpa)', db);
}

console.log(`\nRESULTADO: ${pass} passou, ${fail} falhou`);
process.exit(fail ? 1 : 0);
