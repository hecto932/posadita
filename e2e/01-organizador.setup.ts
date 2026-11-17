import { test as setup, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EVENT, ORGANIZER, PEOPLE } from './fixtures/people';
import { localDateTime } from './helpers/dates';
import { STATE_FILE, type E2EState } from './helpers/env';
import { extractLink, waitForCount, waitForMail, getMail } from './helpers/mailpit';
import { addWishes, expectWishCards, myListSection } from './helpers/wishlist';

setup('el organizador crea el evento, arma su lista e invita a 20 personas', async ({ page }) => {
  setup.setTimeout(120_000);
  let state: E2EState;

  await setup.step('crear el evento desde la página de inicio', async () => {
    await page.goto('/');
    const form = page.locator('#crear');
    await form.getByLabel('Nombre del evento').fill(EVENT.name);
    await form.getByLabel('Monto máximo del regalo').fill(String(EVENT.maxAmountMxn));
    await form.getByLabel('Cupo').fill(String(EVENT.capacity));
    await form.getByLabel('Fecha y hora del intercambio').fill(localDateTime(30));
    await form.getByLabel('Fecha límite para aceptar invitación').fill(localDateTime(23));
    await form.getByLabel('Lugar').fill(EVENT.location);
    await form.getByLabel('Mensaje para los invitados').fill(EVENT.description);
    await form.getByLabel('Tu nombre').fill(ORGANIZER.name);
    await form.getByLabel('Tu correo').fill(ORGANIZER.email);
    await form.getByLabel('Tu WhatsApp').fill(ORGANIZER.phone);
    await expect(form.getByRole('checkbox', { name: /Yo también participo/ })).toBeChecked();
    await form.getByRole('button', { name: 'Crear evento 🎉' }).click();
    await page.waitForURL(/\/admin\/[\w-]+\?nuevo=1/);
  });

  await setup.step('el panel muestra el número de evento y el borrado automático', async () => {
    await expect(page.getByRole('heading', { level: 1, name: EVENT.name })).toBeVisible();
    const chip = await page.getByText(/Evento \d{6}/).first().textContent();
    const slugHref = await page.getByRole('link', { name: /Ver página/ }).getAttribute('href');
    state = {
      adminUrl: new URL(page.url()).pathname,
      eventCode: chip!.match(/\d{6}/)![0],
      eventSlug: slugHref!.replace('/e/', ''),
    };
    await expect(page.getByText(/el evento se borra solo a partir del/)).toBeVisible();
  });

  await setup.step('llega el correo del organizador con su panel', async () => {
    const mail = await waitForMail(ORGANIZER.email, 'está listo');
    expect(extractLink(mail, '/admin/')).toBe(state.adminUrl);
    expect(mail.Text).toContain(state.eventCode);
  });

  await setup.step('el organizador (que también participa) arma su lista con fotos', async () => {
    await page.getByRole('link', { name: /Mi lista/ }).click();
    await page.waitForURL(/\/p\//);
    await addWishes(page, ORGANIZER.wishes);
    await expectWishCards(page, myListSection(page), ORGANIZER.wishes);
  });

  await setup.step('invitar a las 20 personas', async () => {
    await page.goto(state.adminUrl);
    await page.getByLabel('Correos de los invitados').fill(PEOPLE.map((p) => p.email).join('\n'));
    await page.getByRole('button', { name: 'Enviar invitaciones 💌' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Enviando 20 invitaciones.' })).toBeVisible();
    await expect(page.getByText('⏳ Pendiente')).toHaveCount(PEOPLE.length);
  });

  await setup.step('llegan 20 invitaciones a Mailpit, una por persona, con su enlace /i/', async () => {
    const invites = await waitForCount('subject:"te invita"', PEOPLE.length);
    const recipients = invites.flatMap((m) => m.To.map((t) => t.Address)).sort();
    expect(recipients).toEqual(PEOPLE.map((p) => p.email).sort());
    const links = new Set<string>();
    for (const m of invites) links.add(extractLink(await getMail(m.ID), '/i/'));
    expect(links.size, 'cada invitación tiene un enlace distinto').toBe(PEOPLE.length);
  });

  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state!, null, 2));
});
