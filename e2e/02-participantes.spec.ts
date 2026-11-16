import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PEOPLE } from './fixtures/people';
import { STATE_FILE, type E2EState } from './helpers/env';
import { extractCode, extractLink, waitForMail } from './helpers/mailpit';
import { addWishes, expectWishCards, myListSection } from './helpers/wishlist';

test.describe.configure({ mode: 'parallel' });

PEOPLE.forEach((person, i) => {
  test.describe(person.name, () => {
    // Cada invitado "viene de otra IP": el límite de 10 códigos por hora es por IP.
    test.use({ extraHTTPHeaders: { 'x-forwarded-for': `10.20.0.${i + 1}` } });

    test(`${person.email} acepta la invitación y arma su lista`, async ({ page }) => {
      test.setTimeout(120_000);
      const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2EState;

      await test.step('abre el enlace de su correo de invitación', async () => {
        const invite = await waitForMail(person.email, 'te invita');
        await page.goto(extractLink(invite, '/i/'));
        await expect(page.getByRole('button', { name: 'Aceptar invitación 🎁' })).toBeVisible();
      });

      await test.step('escribe nombre y WhatsApp y pide su código', async () => {
        await page.getByLabel('Tu nombre').fill(person.name);
        await page.getByLabel('WhatsApp').fill(person.phone);
        await page.getByRole('button', { name: 'Aceptar invitación 🎁' }).click();
        await expect(page.getByLabel(`Código que te llegó a ${person.email}`)).toBeVisible();
      });

      await test.step('escribe el código que le llegó por correo y entra', async () => {
        const mail = await waitForMail(person.email, 'es tu código para entrar');
        await page.getByLabel(`Código que te llegó a ${person.email}`).fill(extractCode(mail));
        await page.getByRole('button', { name: 'Entrar 🎁' }).click();
        await page.waitForURL(`**/e/${state.eventSlug}?bienvenida=1`);
        await expect(page.getByRole('heading', { name: `¡Ya estás dentro, ${person.name}! 🎉` })).toBeVisible();
      });

      await test.step(`agrega ${person.wishes.length} deseos con foto, nota y enlace`, async () => {
        await addWishes(page, person.wishes);
      });

      await test.step('al recargar, su lista muestra fotos reales servidas por Supabase Storage', async () => {
        await page.reload();
        await expectWishCards(page, myListSection(page), person.wishes);
      });

      await test.step('le llega el correo de bienvenida con su enlace personal', async () => {
        const welcome = await waitForMail(person.email, 'Ya estás en');
        const personal = extractLink(welcome, '/p/');
        await page.goto(personal);
        await expect(page.getByRole('heading', { level: 1, name: `Hola, ${person.name}` })).toBeVisible();
      });
    });
  });
});
