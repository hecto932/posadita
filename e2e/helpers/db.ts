import postgres from 'postgres';
import { E2E_DATABASE_URL } from './env';

/** Conexión directa a la BD del stack e2e (Supabase local), solo para preparar y verificar. */
export function e2eDb() {
  return postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
}
