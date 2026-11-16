import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { e2eDb } from './helpers/db';
import { MAILPIT_URL, SUPABASE_SECRET_KEY, SUPABASE_URL } from './helpers/env';
import { clearMailbox, totalMail } from './helpers/mailpit';

const root = path.join(__dirname, '..');

setup('reiniciar BD, Storage y Mailpit del stack e2e', async () => {
  await setup.step('los servicios locales responden', async () => {
    const hint = 'Levanta el stack con `npm run e2e:up`';
    await fetch(`${MAILPIT_URL}/api/v1/info`).then(
      (r) => expect(r.ok, `Mailpit en ${MAILPIT_URL}. ${hint}`).toBe(true),
      () => expect(false, `Mailpit no responde en ${MAILPIT_URL}. ${hint}`).toBe(true),
    );
    await fetch(`${SUPABASE_URL}/storage/v1/status`).then(
      () => undefined,
      () => expect(false, `Supabase no responde en ${SUPABASE_URL}. ${hint}`).toBe(true),
    );
    expect(SUPABASE_SECRET_KEY, `No se pudo leer la llave de \`npx supabase status\`. ${hint}`).not.toBe('');
  });

  const sql = e2eDb();
  try {
    await setup.step('aplicar db/schema.sql y el bucket privado "wishlist"', async () => {
      await sql.unsafe(await readFile(path.join(root, 'db/schema.sql'), 'utf8'));
      await sql.unsafe(await readFile(path.join(root, 'db/supabase-storage.sql'), 'utf8'));
    });

    await setup.step('vaciar el bucket de imágenes', async () => {
      const storage = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } }).storage;
      const { error } = await storage.emptyBucket('wishlist');
      expect(error, error?.message).toBeNull();
    });

    await setup.step('borrar eventos, códigos, sesiones y límites', async () => {
      await sql`truncate events, rate_limits, login_codes, sessions restart identity cascade`;
    });
  } finally {
    await sql.end();
  }

  await setup.step('vaciar Mailpit', async () => {
    await clearMailbox();
    expect(await totalMail()).toBe(0);
  });
});
