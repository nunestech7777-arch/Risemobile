// Utilitários dos testes de banco (PostgreSQL real via PGlite).
// Requer a dependência de desenvolvimento opcional:  npm i -D @electric-sql/pglite
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SUPABASE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../supabase');
export const MIGRATIONS_DIR = path.join(SUPABASE_DIR, 'migrations');

export async function loadPglite() {
  try {
    const { PGlite } = await import('@electric-sql/pglite');
    const { uuid_ossp } = await import('@electric-sql/pglite/contrib/uuid_ossp');
    return { PGlite, uuid_ossp };
  } catch {
    console.log('⚠️  @electric-sql/pglite não instalado — teste de banco ignorado. Rode: npm i -D @electric-sql/pglite');
    process.exit(0);
  }
}

export async function newDb() {
  const { PGlite, uuid_ossp } = await loadPglite();
  const db = new PGlite({ extensions: { uuid_ossp } });
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  return db;
}

// A migration 007 faz GRANT em uma assinatura de 3 argumentos que nunca existiu; ignoramos só isso.
export function readMigration(file) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  return file.startsWith('007')
    ? sql.replace(/GRANT EXECUTE ON FUNCTION public\.rpc_sync_external_devices\(JSONB, VARCHAR, VARCHAR\)[^;]*;/, '')
    : sql;
}

// Migrations 001..013 + as pedidas (sem RLS/seed/portal de comissionados, que dependem do schema auth)
export async function applyMigrationChain(db, extra = []) {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^(00[1-9]|01[0-3])_/.test(f) && f !== '002_rls_policies.sql' && f !== '004_seed_demo_data.sql')
    .concat(extra)
    .sort();
  for (const file of files) await db.exec(readMigration(file));
}

export const readConsolidated = () => fs.readFileSync(path.join(SUPABASE_DIR, 'consolidated_setup.sql'), 'utf8');
