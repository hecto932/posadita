// Pruebas de integración contra un Postgres real.
// TEST_DATABASE_URL=postgres://postgres@localhost:54329/posadita_test npx vitest run
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d('service (Postgres)', async () => {
  process.env.DATABASE_URL = url;
  const svc = await import('@/lib/service');
  const { db } = await import('@/lib/db');

  const base = {
    description: null,
    location: 'Casa de la tía',
    eventAt: new Date(Date.now() + 2 * 86400_000),
    timezone: 'America/Hermosillo',
    maxAmountMxn: 500,
    signupDeadline: null,
    capacity: null,
    organizerName: 'Héctor',
    organizerEmail: 'hector@example.com',
    organizerPhone: '+526621234567',
    organizerParticipates: true,
  };

  /** Invita y acepta: la única forma de entrar a un evento. */
  async function join(eventId: string, name: string, email: string) {
    const { invited } = await svc.inviteEmails(eventId, [email]);
    return svc.acceptInvitation(invited[0].token, { name, phone: null });
  }

  beforeAll(async () => {
    await db()`truncate events cascade`;
  });
  afterAll(async () => {
    await db().end();
  });

  it('crea evento con organizador participante, invita, sortea y mantiene el secreto', async () => {
    const { event, organizer } = await svc.createEvent({ ...base, name: 'Posada familiar' });
    expect(event.slug).toHaveLength(8);
    expect(organizer?.isOrganizer).toBe(true);

    for (const n of ['Ana', 'Beto', 'Carla']) await join(event.id, n, `${n}@Example.com`);
    // re-invitar a alguien que ya participa no crea invitación
    const again = await svc.inviteEmails(event.id, ['ana@example.com', 'hector@example.com']);
    expect(again.invited).toHaveLength(0);
    expect(again.alreadyIn.sort()).toEqual(['ana@example.com', 'hector@example.com']);

    const list = await svc.listParticipants(event.id);
    expect(list).toHaveLength(4);
    expect(Object.keys(list[0])).not.toContain('accessToken');

    // exclusión Ana ↔ Beto
    const ana = list.find((p) => p.name === 'Ana')!;
    const beto = list.find((p) => p.name === 'Beto')!;
    await svc.addExclusion(event.id, beto.id, ana.id);
    expect(await svc.listExclusions(event.id)).toHaveLength(1);

    const [r1, r2] = await Promise.all([svc.performDraw(event.id), svc.performDraw(event.id)]);
    expect([r1.drawn, r2.drawn].sort()).toEqual([false, true]); // doble clic: solo uno sortea

    const rows = await svc.listAssignments(event.id);
    expect(rows).toHaveLength(4);
    const byGiver = new Map(rows.map((r) => [r.giver.name, r.receiverName]));
    expect(byGiver.get('Ana')).not.toBe('Beto');
    expect(byGiver.get('Beto')).not.toBe('Ana');
    expect(rows[0].giver.createdAt).toBeInstanceOf(Date);

    await expect(svc.inviteEmails(event.id, ['tarde@example.com'])).rejects.toMatchObject({ code: 'CLOSED' });

    const me = await svc.getParticipantByToken(organizer!.accessToken);
    expect(me?.event.status).toBe('drawn');
    expect(me?.event.eventAt).toBeInstanceOf(Date);
    const receiver = await svc.getReceiverFor(organizer!.id);
    expect(receiver?.name).toBe(byGiver.get('Héctor'));
  });

  it('invitaciones: aceptar, rechazar, cancelar y aceptar dos veces', async () => {
    const { event } = await svc.createEvent({ ...base, name: 'Invitaciones', organizerParticipates: false });
    const { invited } = await svc.inviteEmails(event.id, ['uno@i.com', 'DOS@i.com', 'tres@i.com', 'uno@i.com']);
    expect(invited.map((i) => i.email).sort()).toEqual(['dos@i.com', 'tres@i.com', 'uno@i.com']);
    const [uno, dos, tres] = ['uno@i.com', 'dos@i.com', 'tres@i.com'].map((m) => invited.find((i) => i.email === m)!);

    // Nadie es participante hasta aceptar.
    expect(await svc.countParticipants(event.id)).toBe(0);

    const { participant } = await svc.acceptInvitation(uno.token, { name: 'Uno', phone: null });
    expect(participant.email).toBe('uno@i.com');
    await expect(svc.acceptInvitation(uno.token, { name: 'Uno', phone: null })).rejects.toMatchObject({ code: 'INVALID' });

    await svc.declineInvitation(dos.token);
    await expect(svc.declineInvitation(dos.token)).rejects.toMatchObject({ code: 'INVALID' });

    await svc.revokeInvitation(event.id, tres.id);
    await expect(svc.acceptInvitation(tres.token, { name: 'Tres', phone: null })).rejects.toMatchObject({ code: 'INVALID' });
    await expect(svc.acceptInvitation('no-existe', { name: 'x', phone: null })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Quien rechazó puede cambiar de opinión mientras siga abierto.
    await svc.acceptInvitation(dos.token, { name: 'Dos', phone: null });
    expect(await svc.countParticipants(event.id)).toBe(2);

    // Re-invitar a alguien cancelado genera un enlace nuevo; el viejo ya no sirve.
    const re = await svc.inviteEmails(event.id, ['tres@i.com']);
    expect(re.invited[0].token).not.toBe(tres.token);
    expect(re.invited[0].status).toBe('pending');

    const list = await svc.listInvitations(event.id);
    expect(Object.keys(list[0])).not.toContain('token');
    expect(Object.fromEntries(list.map((i) => [i.email, i.status]))).toEqual({
      'uno@i.com': 'accepted',
      'dos@i.com': 'accepted',
      'tres@i.com': 'pending',
    });
  });

  it('nunca sortea solo: ni al llenarse el cupo ni al vencer la fecha límite', async () => {
    const { event } = await svc.createEvent({
      ...base,
      name: 'Oficina',
      capacity: 3,
      organizerParticipates: false,
      signupDeadline: new Date(Date.now() + 60_000),
    });
    const { invited } = await svc.inviteEmails(event.id, ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com']);
    const tok = Object.fromEntries(invited.map((i) => [i.email, i.token]));
    for (const m of ['a@x.com', 'b@x.com', 'c@x.com']) await svc.acceptInvitation(tok[m], { name: m, phone: null });

    expect((await svc.getEventBySlug(event.slug))!.status).toBe('open');
    await expect(svc.acceptInvitation(tok['d@x.com'], { name: 'd', phone: null })).rejects.toMatchObject({ code: 'FULL' });

    await svc.updateEvent(event.id, { capacity: 10 });
    await db()`update events set signup_deadline = now() - interval '1 minute' where id = ${event.id}`;
    await expect(svc.acceptInvitation(tok['e@x.com'], { name: 'e', phone: null })).rejects.toMatchObject({ code: 'DEADLINE' });
    expect((await svc.getEventBySlug(event.slug))!.status).toBe('open');
    expect(await svc.listAssignments(event.id)).toHaveLength(0);

    // Solo el organizador sortea.
    expect(await svc.performDraw(event.id)).toMatchObject({ drawn: true, count: 3 });
  });

  it('entrar con correo + código', async () => {
    const { event } = await svc.createEvent({ ...base, name: 'Códigos', organizerParticipates: false });
    const { participant } = await join(event.id, 'Lupe', 'lupe@c.com');

    expect(await svc.issueLoginCode(event.id, 'nadie@c.com')).toBeNull();

    const issued = (await svc.issueLoginCode(event.id, 'LUPE@c.com'))!;
    expect(issued.code).toMatch(/^\d{6}$/);
    expect(await svc.issueLoginCode(event.id, 'lupe@c.com')).toBeNull(); // espera 1 minuto entre códigos

    const wrong = issued.code === '000000' ? '111111' : '000000';
    await expect(svc.verifyLoginCode(event.id, 'lupe@c.com', wrong)).rejects.toMatchObject({ code: 'CODE_INVALID' });
    const me = await svc.verifyLoginCode(event.id, 'lupe@c.com', issued.code);
    expect(me.accessToken).toBe(participant.accessToken);
    // un código usado no se reutiliza
    await expect(svc.verifyLoginCode(event.id, 'lupe@c.com', issued.code)).rejects.toMatchObject({ code: 'CODE_INVALID' });
    // otro evento no acepta el código
    const other = await svc.createEvent({ ...base, name: 'Otro', organizerParticipates: false });
    await expect(svc.verifyLoginCode(other.event.id, 'lupe@c.com', issued.code)).rejects.toMatchObject({ code: 'CODE_INVALID' });

    // 5 intentos fallidos bloquean el código, aunque luego llegue el correcto
    await db()`delete from login_codes where event_id = ${event.id}`;
    const second = (await svc.issueLoginCode(event.id, 'lupe@c.com'))!;
    const bad = second.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      await expect(svc.verifyLoginCode(event.id, 'lupe@c.com', bad)).rejects.toMatchObject({ code: 'CODE_INVALID' });
    await expect(svc.verifyLoginCode(event.id, 'lupe@c.com', second.code)).rejects.toMatchObject({ code: 'CODE_INVALID' });

    // un código vencido no sirve
    await db()`delete from login_codes where event_id = ${event.id}`;
    const third = (await svc.issueLoginCode(event.id, 'lupe@c.com'))!;
    await db()`update login_codes set expires_at = now() - interval '1 second' where event_id = ${event.id}`;
    await expect(svc.verifyLoginCode(event.id, 'lupe@c.com', third.code)).rejects.toMatchObject({ code: 'CODE_INVALID' });
  });

  it('quitar a alguien después del sorteo re-sortea sin romper el ciclo', async () => {
    const { event } = await svc.createEvent({ ...base, name: 'Primos' });
    for (const n of ['a', 'b', 'c', 'd']) await join(event.id, n, `${n}@p.com`);
    await svc.performDraw(event.id);
    const victim = (await svc.listParticipants(event.id)).find((p) => p.name === 'c')!;
    const res = await svc.removeParticipant(event.id, victim.id);
    expect(res.wasDrawn).toBe(true);
    expect(res.draw).toMatchObject({ drawn: true, count: 4 });
    const rows = await svc.listAssignments(event.id);
    expect(rows.map((r) => r.receiverName)).not.toContain('c');

    await svc.reopenEvent(event.id);
    expect((await svc.getEventBySlug(event.slug))!.status).toBe('open');
    expect(await svc.listAssignments(event.id)).toHaveLength(0);
  });

  it('lista de deseos: alta, edición con reemplazo de imagen, baja', async () => {
    const { organizer } = await svc.createEvent({ ...base, name: 'Wishlist' });
    const item = await svc.addItem(organizer!.id, {
      title: 'Audífonos',
      note: 'Bluetooth',
      url: 'https://example.com/x',
      estPriceMxn: 450,
      imagePath: 'e/p/old.webp',
    });
    const upd = await svc.updateItem(organizer!.id, item.id, {
      title: 'Audífonos',
      note: null,
      url: null,
      estPriceMxn: 400,
      imagePath: 'e/p/new.webp',
    });
    expect(upd?.oldImagePath).toBe('e/p/old.webp');
    expect(await svc.updateItem('00000000-0000-0000-0000-000000000000', item.id, { title: 'x', note: null, url: null, estPriceMxn: null })).toBeNull();
    expect(await svc.deleteItem(organizer!.id, item.id)).toBe('e/p/new.webp');
    expect(await svc.listItems(organizer!.id)).toHaveLength(0);
  });

  it('recordatorio: solo eventos sorteados próximos, una sola vez', async () => {
    const due = await svc.eventsNeedingReminder(3);
    expect(due.length).toBeGreaterThan(0);
    const id = due[0].id;
    expect(await svc.claimReminder(id)).toBe(true);
    expect(await svc.claimReminder(id)).toBe(false);
  });

  it('actualiza evento y valida cupo', async () => {
    const { event } = await svc.createEvent({ ...base, name: 'Editar' });
    await join(event.id, 'q', 'q@x.com');
    await join(event.id, 'w', 'w@x.com');
    await expect(svc.updateEvent(event.id, { capacity: 3 })).resolves.toMatchObject({ capacity: 3 });
    await expect(join(event.id, 'e', 'e@x.com')).rejects.toMatchObject({ code: 'FULL' });
    const e2 = await svc.updateEvent(event.id, { maxAmountMxn: 800, name: 'Editado' });
    expect(e2.maxAmountMxn).toBe(800);
    const paths = await svc.deleteEvent(event.id);
    expect(paths).toEqual([]);
    expect(await svc.getEventBySlug(event.slug)).toBeNull();
  });
  it('anti-abuso: límite por ventana, con costo variable', async () => {
    const key = `test:${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) await svc.hitRateLimit(key, 3, 3600);
    await expect(svc.hitRateLimit(key, 3, 3600)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    const bulk = `test:${crypto.randomUUID()}`;
    await svc.hitRateLimit(bulk, 100, 3600, 60);
    await expect(svc.hitRateLimit(bulk, 100, 3600, 50)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('anti-abuso: tope diario de códigos por correo', async () => {
    const { event } = await svc.createEvent({ ...base, name: 'Tope códigos', organizerParticipates: false });
    await join(event.id, 'Rosa', 'rosa@t.com');
    // 8 códigos en el día, ninguno en el último minuto
    await db()`
      insert into login_codes (event_id, email, code_hash, expires_at, created_at)
      select ${event.id}, 'rosa@t.com', 'x', now(), now() - make_interval(mins => g * 10)
      from generate_series(1, 8) g`;
    expect(await svc.issueLoginCode(event.id, 'rosa@t.com')).toBeNull();
    await db()`delete from login_codes where event_id = ${event.id} and created_at < now() - interval '70 minutes'`;
    expect(await svc.issueLoginCode(event.id, 'rosa@t.com')).not.toBeNull();
  });

  it('anti-abuso: reenviar invitación espera unos minutos y hay tope por evento', async () => {
    const { event } = await svc.createEvent({ ...base, name: 'Reenvíos', organizerParticipates: false });
    const { invited } = await svc.inviteEmails(event.id, ['re@x.com']);
    expect(invited[0].lastSentAt).toBeInstanceOf(Date);
    await expect(svc.claimInvitationResend(event.id, invited[0].id)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await db()`update invitations set last_sent_at = now() - interval '11 minutes' where id = ${invited[0].id}`;
    await expect(svc.claimInvitationResend(event.id, invited[0].id)).resolves.toMatchObject({ email: 're@x.com' });
    await svc.revokeInvitation(event.id, invited[0].id);
    await expect(svc.claimInvitationResend(event.id, invited[0].id)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await db()`
      insert into invitations (event_id, email, token)
      select ${event.id}, 'bulk' || g || '@x.com', 'tok-' || ${event.id} || '-' || g
      from generate_series(1, ${svc.MAX_INVITATIONS_PER_EVENT - 2}) g`;
    // 199 invitaciones; re-invitar una existente no cuenta doble, pero 2 nuevas sí pasan del tope
    await expect(svc.inviteEmails(event.id, ['bulk1@x.com', 'nuevo@x.com'])).resolves.toBeTruthy();
    await expect(svc.inviteEmails(event.id, ['otro@x.com'])).rejects.toMatchObject({ code: 'INVALID' });
  });

  it('recuperar panel: eventos por correo del organizador', async () => {
    await svc.createEvent({ ...base, name: 'Panel perdido', organizerEmail: 'olvido@x.com' });
    const evs = await svc.eventsByOrganizerEmail(' OLVIDO@x.com ');
    expect(evs.map((e) => e.name)).toEqual(['Panel perdido']);
    expect(await svc.eventsByOrganizerEmail('nadie@x.com')).toEqual([]);
  });
});
