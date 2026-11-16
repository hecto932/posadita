import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ALL, PEOPLE, TOTAL_WISHES } from './fixtures/people';
import { e2eDb } from './helpers/db';
import { STATE_FILE, type E2EState } from './helpers/env';
import { extractLink, getMail, totalMail, waitForCount } from './helpers/mailpit';
import { expectWishCards } from './helpers/wishlist';

/** Correos esperados de punta a punta: 1 al organizador + 20 invitaciones + 20 códigos + 20 bienvenidas + 21 sorteos. */
const EXPECTED_MAIL = {
  organizer: { n: 1, label: 'Panel al organizador' },
  invitation: { n: PEOPLE.length, label: 'Invitaciones' },
  invite_code: { n: PEOPLE.length, label: 'Códigos de invitación' },
  registered: { n: PEOPLE.length, label: 'Bienvenida' },
  draw: { n: ALL.length, label: 'Resultado del sorteo' },
};
const EXPECTED_TOTAL = Object.values(EXPECTED_MAIL).reduce((n, k) => n + k.n, 0);

test('el organizador hace el sorteo y cada quien ve la lista (con fotos) de su amigo secreto', async ({ page }) => {
  test.setTimeout(300_000);
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2EState;

  await test.step('el panel muestra a las 21 personas, todas con su lista', async () => {
    await page.goto(state.adminUrl);
    await expect(page.getByText('✓ Aceptó')).toHaveCount(PEOPLE.length);
    await expect(page.getByText('⏳ Pendiente')).toHaveCount(0);
    for (const p of ALL) await expect(page.getByText(`${p.email} · `)).toContainText(`${p.wishes.length} deseos`);
  });

  await test.step('hacer el sorteo (aceptando la confirmación)', async () => {
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Hacer el sorteo ahora 🎲' }).click();
    // El panel se re-renderiza en estado "sorteado" (el botón y su mensaje desaparecen).
    await expect(page.getByRole('heading', { name: /Sorteo hecho 🎲/ })).toBeVisible();
    await expect(page.getByText('🎲 Sorteo hecho')).toBeVisible();
  });

  const draws = await test.step(`llegan ${ALL.length} correos del sorteo`, async () => {
    const list = await waitForCount('subject:"Ya se hizo el sorteo"', ALL.length);
    return Promise.all(list.map((m) => getMail(m.ID)));
  });

  await test.step('el sorteo es válido: todos dan y reciben una vez y nadie se tocó a sí mismo', async () => {
    const givers = draws.map((m) => m.To[0].Address).sort();
    const receivers = draws.map((m) => m.Text.match(/te tocó… (.+) 🤫/)![1]).sort();
    expect(givers).toEqual(ALL.map((p) => p.email).sort());
    expect(receivers).toEqual(ALL.map((p) => p.name).sort());
    for (const m of draws) {
      const giver = ALL.find((p) => p.email === m.To[0].Address)!;
      expect(m.Text).not.toContain(`te tocó… ${giver.name} 🤫`);
    }
  });

  for (const mail of draws) {
    const giver = ALL.find((p) => p.email === mail.To[0].Address)!;
    const receiver = ALL.find((p) => p.name === mail.Text.match(/te tocó… (.+) 🤫/)![1])!;
    await test.step(`${giver.name} abre su correo y ve la lista de ${receiver.name}`, async () => {
      await page.goto(extractLink(mail, '/p/'));
      await expect(page.getByText('Tu amigo secreto es…')).toBeVisible();
      const section = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: `Lo que le gustaría a ${receiver.name}`, exact: true }) });
      await expectWishCards(page, section, receiver.wishes);
    });
  }

  await test.step(`Mailpit tiene exactamente ${EXPECTED_TOTAL} correos y ninguno salió por Gmail`, async () => {
    expect(await totalMail()).toBe(EXPECTED_TOTAL);
  });

  await test.step('la BD registra cada correo como enviado y cada foto en Storage', async () => {
    const sql = e2eDb();
    try {
      const rows = await sql<{ kind: string; status: string; n: number }[]>`
        select kind, status, count(*)::int as n from notifications group by kind, status order by kind`;
      expect(rows.filter((r) => r.status !== 'sent'), 'correos que no se enviaron').toEqual([]);
      expect(Object.fromEntries(rows.map((r) => [r.kind, r.n]))).toEqual(
        Object.fromEntries(Object.entries(EXPECTED_MAIL).map(([k, v]) => [k, v.n])),
      );
      const [items] = await sql<{ total: number; withImage: number }[]>`
        select count(*)::int as total, count(image_path)::int as "withImage" from wishlist_items`;
      expect(items).toEqual({ total: TOTAL_WISHES, withImage: TOTAL_WISHES });
      const [objects] = await sql<{ n: number }[]>`select count(*)::int as n from storage.objects where bucket_id = 'wishlist'`;
      expect(objects.n, 'archivos en el bucket wishlist').toBe(TOTAL_WISHES);
    } finally {
      await sql.end();
    }
  });

  await test.step('la sección "Correos" del panel cuadra', async () => {
    await page.goto(state.adminUrl);
    for (const { n, label } of Object.values(EXPECTED_MAIL)) {
      await expect(page.getByText(`${label}: ${n} enviados`, { exact: true })).toBeVisible();
    }
  });
});
