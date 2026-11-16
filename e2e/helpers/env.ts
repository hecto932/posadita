import { execSync } from 'node:child_process';

/** Puertos y credenciales del stack e2e local (supabase start + docker-compose.e2e.yml). */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://localhost:${E2E_PORT}`;
export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8026';
export const MAILPIT_SMTP_PORT = process.env.MAILPIT_SMTP_PORT ?? '1026';
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';

/**
 * Llave secreta del Supabase LOCAL. No se guarda en el repo: se lee de `supabase status`
 * una sola vez (al cargar playwright.config) y se pasa a los workers por process.env.
 * Si el stack no está arriba queda vacía y la etapa "reset" pide correr `npm run e2e:up`.
 */
function localSupabaseSecretKey(): string {
  if (process.env.E2E_SUPABASE_SECRET_KEY !== undefined) return process.env.E2E_SUPABASE_SECRET_KEY;
  let key = '';
  try {
    const out = execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
    const status = JSON.parse(out.slice(out.indexOf('{'))) as { SECRET_KEY?: string; SERVICE_ROLE_KEY?: string };
    key = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY ?? '';
  } catch {
    // Supabase local apagado: se reporta en la etapa "reset".
  }
  process.env.E2E_SUPABASE_SECRET_KEY = key;
  return key;
}

export const SUPABASE_SECRET_KEY = localSupabaseSecretKey();
export const STATE_FILE = `${__dirname}/../.state/event.json`;

export type E2EState = { adminUrl: string; eventCode: string; eventSlug: string };
