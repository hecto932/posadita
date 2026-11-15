import postgres from 'postgres';

declare global {
  var __posaditaSql: postgres.Sql | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    // Supabase "Transaction pooler" (puerto 6543) no soporta prepared statements.
    prepare: false,
    // Supavisor antiguo se cuelga con queries en pipeline; 1 es lo seguro.
    max_pipeline: 1,
    max: Number(process.env.DB_POOL_MAX ?? 3),
    idle_timeout: 20,
    // Si Supabase no responde, fallar rápido (el default es 30 s) y mostrar error.tsx.
    connect_timeout: 10,
    query_timeout: 15,
    ssl: isLocal ? false : 'require',
    transform: postgres.camel,
    onnotice: () => {},
  });
}

/** Un solo pool por proceso (y sobrevive al hot-reload en dev). */
export function db(): postgres.Sql {
  globalThis.__posaditaSql ??= createClient();
  return globalThis.__posaditaSql;
}

export type Sql = postgres.Sql | postgres.TransactionSql;
