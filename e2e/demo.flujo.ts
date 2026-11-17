import { test, expect } from '@playwright/test';
import { EVENT, ORGANIZER, PEOPLE, type Person } from './fixtures/people';
import { localDateTime } from './helpers/dates';
import { e2eDb } from './helpers/db';
import { addWishesSlowly, Narrator, pause, spot, type } from './helpers/demo';
import { MAILPIT_URL } from './helpers/env';
import { extractCode, extractLink, getMail, totalMail, waitForCount, waitForMail, type Mail } from './helpers/mailpit';
import { expectWishCards, myListSection } from './helpers/wishlist';

/**
 * Demo visual del flujo completo en UNA ventana de Chromium con tres pestañas:
 *   👑 Organizador · 📬 Correo (Mailpit) · 🙋 Invitado
 * Hace las mismas verificaciones que las pruebas e2e, pero en orden y despacio.
 * Correr con `npm run e2e:demo`. DEMO_PEOPLE=5 para una versión corta.
 */
const COUNT = Math.min(PEOPLE.length, Math.max(2, Number(process.env.DEMO_PEOPLE ?? PEOPLE.length)));
const GUESTS = PEOPLE.slice(0, COUNT);
const EVERYONE = [ORGANIZER, ...GUESTS];

test('demo: crear evento → invitar → aceptar → sorteo', async ({ page: org, context }) => {
  test.setTimeout(0);
  const inbox = await context.newPage();
  const guest = await context.newPage();
  const say = {
    org: new Narrator(org, '👑 Organizador'),
    inbox: new Narrator(inbox, '📬 Correo (Mailpit)'),
    guest: new Narrator(guest, '🙋 Invitado'),
  };
  await inbox.goto(MAILPIT_URL);
  await guest.goto('about:blank');

  /** Muestra un correo en Mailpit (pestaña Correo) tal como lo vería la persona. */
  async function showMail(mail: Mail, title: string, detail = '') {
    await inbox.bringToFront();
    await inbox.goto(`${MAILPIT_URL}/view/${mail.ID}`);
    await say.inbox.say(title, detail || `Para: ${mail.To[0].Address} · “${mail.Subject}”`);
    await pause(inbox, 1.5);
  }

  let adminUrl = '';

  // ───────────── 1. Crear el evento ─────────────
  await test.step('1 · el organizador crea el evento', async () => {
    await org.bringToFront();
    await org.goto('/');
    const form = org.locator('#crear');
    await spot(form.getByRole('heading', { name: 'Crea tu evento' }));
    await say.org.say('Paso 1 · El organizador crea el evento', EVENT.name);
    await type(form.getByLabel('Nombre del evento'), EVENT.name);
    await type(form.getByLabel('Monto máximo del regalo'), String(EVENT.maxAmountMxn));
    await type(form.getByLabel('Cupo'), String(EVENT.capacity));
    await form.getByLabel('Fecha y hora del intercambio').fill(localDateTime(30));
    await form.getByLabel('Fecha límite para aceptar invitación').fill(localDateTime(23));
    await type(form.getByLabel('Lugar'), EVENT.location);
    await type(form.getByLabel('Mensaje para los invitados'), EVENT.description);
    await say.org.say('Paso 1 · Datos del organizador', `${ORGANIZER.name} · ${ORGANIZER.email} · también participa`);
    await type(form.getByLabel('Tu nombre'), ORGANIZER.name);
    await type(form.getByLabel('Tu correo'), ORGANIZER.email);
    await type(form.getByLabel('Tu WhatsApp'), ORGANIZER.phone);
    await spot(form.getByRole('checkbox', { name: /Yo también participo/ }), 0.5);
    await spot(form.getByRole('button', { name: 'Crear evento 🎉' }), 0.5);
    await form.getByRole('button', { name: 'Crear evento 🎉' }).click();
    await org.waitForURL(/\/admin\/[\w-]+\?nuevo=1/);
    adminUrl = new URL(org.url()).pathname;
    await say.org.say('✅ Evento creado: este es el panel del organizador');
    await expect(org.getByRole('heading', { level: 1, name: EVENT.name })).toBeVisible();
    await spot(org.getByText(/Evento \d{6}/).first());
    await spot(org.getByText(/el evento se borra solo a partir del/));
  });

  await test.step('1b · le llega su correo con el panel', async () => {
    const mail = await waitForMail(ORGANIZER.email, 'está listo');
    expect(extractLink(mail, '/admin/')).toBe(adminUrl);
    await showMail(mail, '📬 Le llegó al organizador el correo con su panel');
  });

  // ───────────── 2. Lista del organizador ─────────────
  await test.step('2 · el organizador arma su lista', async () => {
    await org.bringToFront();
    await say.org.say('Paso 2 · El organizador también participa: arma su lista de deseos');
    await spot(org.getByRole('link', { name: /Mi lista/ }), 0.5);
    await org.getByRole('link', { name: /Mi lista/ }).click();
    await org.waitForURL(/\/p\//);
    await addWishesSlowly(org, ORGANIZER.wishes, say.org, ORGANIZER.name);
    await expectWishCards(org, myListSection(org), ORGANIZER.wishes);
  });

  // ───────────── 3. Invitar ─────────────
  const invitations = await test.step(`3 · invita a ${COUNT} personas`, async () => {
    await org.goto(adminUrl);
    const box = org.getByLabel('Correos de los invitados');
    await say.org.say(`Paso 3 · Invitar a ${COUNT} personas por correo`);
    await spot(box, 0.5);
    await type(box, GUESTS.map((p) => p.email).join(', '));
    await org.getByRole('button', { name: 'Enviar invitaciones 💌' }).click();
    await expect(org.getByRole('status').filter({ hasText: `Enviando ${COUNT} invitaci` })).toBeVisible();
    await expect(org.getByText('⏳ Pendiente')).toHaveCount(COUNT);
    await say.org.say(`✅ ${COUNT} invitaciones enviadas`, 'Todas empiezan como ⏳ Pendiente');
    await spot(org.locator('ul').filter({ has: org.getByText('⏳ Pendiente').first() }), 1.5);

    const list = await waitForCount('subject:"te invita"', COUNT);
    await inbox.bringToFront();
    await inbox.goto(MAILPIT_URL);
    await say.inbox.say(`📬 Llegaron ${COUNT} invitaciones a la bandeja local`, 'Nada sale a internet: Mailpit las atrapa todas');
    await pause(inbox, 2);
    return list;
  });

  // ───────────── 4. Cada invitado acepta ─────────────
  async function acceptAs(person: Person, n: number) {
    const who = `${person.name} (${n}/${COUNT})`;
    // Cada invitado "viene de otra IP": el límite de códigos es por IP.
    await guest.setExtraHTTPHeaders({ 'x-forwarded-for': `10.30.0.${n}` });

    const invite = await getMail(invitations.find((m) => m.To[0].Address === person.email)!.ID);
    await showMail(invite, `Paso 4 · ${who} abre su invitación`);

    await guest.bringToFront();
    await guest.goto(extractLink(invite, '/i/'));
    await say.guest.say(`${who} aceptará la invitación`, 'Escribe su nombre y WhatsApp');
    await type(guest.getByLabel('Tu nombre'), person.name);
    await type(guest.getByLabel('WhatsApp'), person.phone);
    await guest.getByRole('button', { name: 'Aceptar invitación 🎁' }).click();
    const codeField = guest.getByLabel(`Código que te llegó a ${person.email}`);
    await expect(codeField).toBeVisible();
    await say.guest.say(`${who} pidió su código`, 'Le llega un código de 4 dígitos a su correo');
    await pause(guest, 0.5);

    const codeMail = await waitForMail(person.email, 'es tu código para entrar');
    const code = extractCode(codeMail);
    await showMail(codeMail, `📬 Le llegó el código ${code} a ${person.name}`);

    await guest.bringToFront();
    await say.guest.say(`${who} escribe el código ${code}`);
    await type(codeField, code);
    await guest.getByRole('button', { name: 'Entrar 🎁' }).click();
    await guest.waitForURL(/\/e\/[\w-]+\?bienvenida=1/);
    await expect(guest.getByRole('heading', { name: `¡Ya estás dentro, ${person.name}! 🎉` })).toBeVisible();
    await say.guest.say(`✅ ${person.name} ya está dentro del evento`);
    await spot(guest.getByRole('heading', { name: `¡Ya estás dentro, ${person.name}! 🎉` }), 0.6);

    await addWishesSlowly(guest, person.wishes, say.guest, person.name);
    await guest.reload();
    await say.guest.say(`${person.name} ve su lista con fotos guardadas en Supabase Storage`);
    await expectWishCards(guest, myListSection(guest), person.wishes);
    await waitForMail(person.email, 'Ya estás en');

    await org.bringToFront();
    await org.goto(adminUrl);
    const row = org.locator('li').filter({ has: org.getByText(person.email, { exact: true }) });
    await expect(row).toContainText('✓ Aceptó');
    await expect(org.getByText('✓ Aceptó')).toHaveCount(n);
    await say.org.say(`👑 El panel se actualiza: ${person.name} aceptó`, `Aceptadas ${n} de ${COUNT} · pendientes ${COUNT - n}`);
    await spot(row);
    await spot(org.locator('h2').filter({ hasText: 'Participantes' }), 0.6);
  }

  for (const [i, person] of GUESTS.entries()) {
    await test.step(`4 · ${person.name} acepta y arma su lista`, () => acceptAs(person, i + 1));
  }

  // ───────────── 5. Sorteo ─────────────
  await test.step('5 · el organizador hace el sorteo', async () => {
    await org.bringToFront();
    await org.goto(adminUrl);
    await expect(org.getByText('⏳ Pendiente')).toHaveCount(0);
    await say.org.say(`Paso 5 · Las ${COUNT} invitaciones fueron aceptadas: ¡a sortear!`, `${EVERYONE.length} participantes con su lista`);
    const draw = org.getByRole('button', { name: 'Hacer el sorteo ahora 🎲' });
    await spot(draw, 1.2);
    org.once('dialog', async (d) => {
      await pause(org, 1);
      await d.accept();
    });
    await draw.click();
    await expect(org.getByRole('heading', { name: /Sorteo hecho 🎲/ })).toBeVisible({ timeout: 20_000 });
    await say.org.say('✅ ¡Sorteo hecho! Ni el organizador sabe quién le tocó a quién 🤫');
    await spot(org.getByRole('heading', { name: /Sorteo hecho 🎲/ }), 1.5);
  });

  const draws = await test.step(`5b · llegan ${EVERYONE.length} correos del sorteo`, async () => {
    const list = await waitForCount('subject:"Ya se hizo el sorteo"', EVERYONE.length);
    await inbox.bringToFront();
    await inbox.goto(MAILPIT_URL);
    await say.inbox.say(`📬 Llegaron ${EVERYONE.length} correos del sorteo, uno por persona`);
    await pause(inbox, 2);
    return Promise.all(list.map((m) => getMail(m.ID)));
  });

  await test.step('5c · el sorteo es válido', () => {
    const receiverOf = (m: Mail) => m.Text.match(/te tocó… (.+) 🤫/)![1];
    expect(draws.map((m) => m.To[0].Address).sort()).toEqual(EVERYONE.map((p) => p.email).sort());
    expect(draws.map(receiverOf).sort()).toEqual(EVERYONE.map((p) => p.name).sort());
    for (const m of draws) expect(receiverOf(m)).not.toBe(EVERYONE.find((p) => p.email === m.To[0].Address)!.name);
  });

  // ───────────── 6. Cada quien ve a su amigo secreto ─────────────
  for (const [i, mail] of draws.entries()) {
    const giver = EVERYONE.find((p) => p.email === mail.To[0].Address)!;
    const receiver = EVERYONE.find((p) => p.name === mail.Text.match(/te tocó… (.+) 🤫/)![1])!;
    await test.step(`6 · ${giver.name} ve la lista de ${receiver.name}`, async () => {
      await showMail(mail, `Paso 6 · ${giver.name} abre el correo del sorteo (${i + 1}/${draws.length})`);
      await guest.bringToFront();
      await guest.goto(extractLink(mail, '/p/'));
      await say.guest.say(`🎁 A ${giver.name} le tocó ${receiver.name}`, `Ve su lista: ${receiver.wishes.length} deseos con foto y enlace`);
      await spot(guest.getByText('Tu amigo secreto es…').locator('..'), 0.8);
      const section = guest
        .locator('section')
        .filter({ has: guest.getByRole('heading', { name: `Lo que le gustaría a ${receiver.name}`, exact: true }) });
      await expectWishCards(guest, section, receiver.wishes);
      for (const card of await section.locator('article').all()) await spot(card, 0.4);
    });
  }

  // ───────────── 7. Resultado final ─────────────
  await test.step('7 · todo cuadra', async () => {
    const expected = { organizer: 1, invitation: COUNT, invite_code: COUNT, registered: COUNT, draw: EVERYONE.length };
    const total = Object.values(expected).reduce((a, b) => a + b, 0);
    expect(await totalMail()).toBe(total);
    const sql = e2eDb();
    try {
      const rows = await sql<{ kind: string; status: string; n: number }[]>`
        select kind, status, count(*)::int as n from notifications group by kind, status`;
      expect(rows.filter((r) => r.status !== 'sent')).toEqual([]);
      expect(Object.fromEntries(rows.map((r) => [r.kind, r.n]))).toEqual(expected);
    } finally {
      await sql.end();
    }
    await org.bringToFront();
    await org.goto(adminUrl);
    const mails = org.locator('section').filter({ has: org.getByRole('heading', { name: 'Correos', exact: true }) });
    await say.org.say(`✅ Flujo completo verificado: ${total} correos enviados, 0 fallidos`, `${EVERYONE.length} personas · ${EVERYONE.reduce((n, p) => n + p.wishes.length, 0)} deseos con foto · sorteo válido`);
    await spot(mails, 3);
  });
});
