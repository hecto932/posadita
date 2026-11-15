import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { db, type Sql } from './db';
import { drawPairs, DrawError } from './draw';
import { slug as newSlug, token as newToken } from './format';
import { MIN_PARTICIPANTS } from './config';

// ───────────────────────── Tipos ─────────────────────────

export type EventRow = {
  id: string;
  slug: string;
  adminToken: string;
  name: string;
  description: string | null;
  location: string | null;
  eventAt: Date | null;
  timezone: string;
  maxAmountMxn: number;
  signupDeadline: Date | null;
  capacity: number | null;
  organizerName: string;
  organizerEmail: string;
  status: 'open' | 'drawn';
  drawnAt: Date | null;
  reminderSentAt: Date | null;
  createdAt: Date;
};

export type Participant = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string | null;
  accessToken: string;
  isOrganizer: boolean;
  createdAt: Date;
};

export type WishItem = {
  id: string;
  participantId: string;
  title: string;
  note: string | null;
  url: string | null;
  imagePath: string | null;
  estPriceMxn: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export type Invitation = {
  id: string;
  eventId: string;
  email: string;
  token: string;
  status: InvitationStatus;
  createdAt: Date;
  respondedAt: Date | null;
  lastSentAt: Date | null;
};

export class AppError extends Error {
  constructor(
    public code:
      | 'NOT_FOUND'
      | 'CLOSED'
      | 'FULL'
      | 'DEADLINE'
      | 'EMAIL_TAKEN'
      | 'NOT_ENOUGH'
      | 'IMPOSSIBLE'
      | 'ALREADY_DRAWN'
      | 'CODE_INVALID'
      | 'RATE_LIMITED'
      | 'INVALID',
    message: string,
  ) {
    super(message);
  }
}

export type DrawOutcome = { drawn: true; count: number } | { drawn: false; reason: AppError['code']; message: string };

// ───────────────────────── Eventos ─────────────────────────

export type NewEvent = {
  name: string;
  description: string | null;
  location: string | null;
  eventAt: Date | null;
  timezone: string;
  maxAmountMxn: number;
  signupDeadline: Date | null;
  capacity: number | null;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string | null;
  organizerParticipates: boolean;
};

export async function createEvent(input: NewEvent) {
  const { organizerPhone, organizerParticipates, ...fields } = input;
  return db().begin(async (tx) => {
    const [event] = await tx<EventRow[]>`
      insert into events ${tx({ ...fields, slug: newSlug(), adminToken: newToken() })}
      returning *`;
    let organizer: Participant | null = null;
    if (organizerParticipates) {
      [organizer] = await tx<Participant[]>`
        insert into participants ${tx({
          eventId: event.id,
          name: input.organizerName,
          email: input.organizerEmail,
          phone: organizerPhone,
          accessToken: newToken(),
          isOrganizer: true,
        })}
        returning *`;
    }
    return { event, organizer };
  });
}

export async function getEventBySlug(slug: string) {
  const [e] = await db()<EventRow[]>`select * from events where slug = ${slug}`;
  return e ?? null;
}

export async function getEventByAdminToken(token: string) {
  const [e] = await db()<EventRow[]>`select * from events where admin_token = ${token}`;
  return e ?? null;
}

export type EventPatch = Partial<
  Pick<EventRow, 'name' | 'description' | 'location' | 'eventAt' | 'timezone' | 'maxAmountMxn' | 'signupDeadline' | 'capacity'>
>;

export async function updateEvent(eventId: string, patch: EventPatch) {
  return db().begin(async (tx) => {
    const ev = await lockEvent(tx, eventId);
    if (patch.capacity != null) {
      const n = await countParticipants(eventId, tx);
      if (patch.capacity < n) throw new AppError('INVALID', `Ya hay ${n} registrados; el cupo no puede ser menor.`);
    }
    // Cambiar fecha del evento vuelve a habilitar el recordatorio.
    const resetReminder = patch.eventAt !== undefined && +(patch.eventAt ?? 0) !== +(ev.eventAt ?? 0);
    const [e] = await tx<EventRow[]>`
      update events set ${tx(patch)} ${resetReminder ? tx`, reminder_sent_at = null` : tx``}
      where id = ${eventId} returning *`;
    return e;
  });
}

/** Borra el evento y regresa las rutas de imágenes que hay que limpiar del Storage. */
export async function deleteEvent(eventId: string): Promise<string[]> {
  return db().begin(async (tx) => {
    const imgs = await tx<{ imagePath: string }[]>`
      select w.image_path from wishlist_items w
      join participants p on p.id = w.participant_id
      where p.event_id = ${eventId} and w.image_path is not null`;
    await tx`delete from events where id = ${eventId}`;
    return imgs.map((r) => r.imagePath);
  });
}

async function lockEvent(tx: Sql, eventId: string): Promise<EventRow> {
  const [e] = await tx<EventRow[]>`select * from events where id = ${eventId} for update`;
  if (!e) throw new AppError('NOT_FOUND', 'El evento no existe');
  return e;
}

// ───────────────────────── Participantes ─────────────────────────

export async function countParticipants(eventId: string, sql: Sql = db()) {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from participants where event_id = ${eventId}`;
  return n;
}

export type ParticipantSummary = Pick<Participant, 'id' | 'name' | 'email' | 'phone' | 'isOrganizer' | 'createdAt'> & {
  itemCount: number;
};

/** Lista para el organizador: SIN access_token. */
export async function listParticipants(eventId: string) {
  return db()<ParticipantSummary[]>`
    select p.id, p.name, p.email, p.phone, p.is_organizer, p.created_at,
           (select count(*)::int from wishlist_items w where w.participant_id = p.id) as item_count
    from participants p where p.event_id = ${eventId}
    order by p.created_at`;
}

/** Solo nombres, para la página pública. */
export async function listParticipantNames(eventId: string) {
  const rows = await db()<{ name: string }[]>`
    select name from participants where event_id = ${eventId} order by created_at`;
  return rows.map((r) => r.name);
}

export async function getParticipantByToken(token: string) {
  const [row] = await db()<(Participant & { event: EventRow })[]>`
    select p.*, to_jsonb(e.*) as event
    from participants p join events e on e.id = p.event_id
    where p.access_token = ${token}`;
  if (!row) return null;
  const { event, ...participant } = row;
  return { participant: participant as Participant, event: reviveEvent(event) };
}

/** Solo la página propia del organizador (si participa). */
export async function getOrganizerParticipant(eventId: string) {
  const [p] = await db()<Participant[]>`
    select * from participants where event_id = ${eventId} and is_organizer limit 1`;
  return p ?? null;
}

/** Revisa que el evento todavía acepte gente (estado, fecha límite y cupo). */
async function assertCanJoin(tx: Sql, event: EventRow) {
  if (event.status !== 'open') throw new AppError('CLOSED', 'El sorteo ya se hizo; ya no se puede entrar.');
  if (event.signupDeadline && event.signupDeadline < new Date())
    throw new AppError('DEADLINE', 'Ya pasó la fecha límite para aceptar invitaciones.');
  if (event.capacity && (await countParticipants(event.id, tx)) >= event.capacity)
    throw new AppError('FULL', 'El grupo ya está completo.');
}

// ───────────────────────── Invitaciones ─────────────────────────

/**
 * Invita correos al evento. Omite a quien ya participa. Si alguien había
 * rechazado, fue revocado o salió del evento, su invitación vuelve a "pendiente"
 * con un enlace nuevo; si seguía pendiente conserva el mismo enlace.
 */
export const MAX_INVITATIONS_PER_EVENT = 200;
export const INVITATION_RESEND_COOLDOWN_MINUTES = 10;

export async function inviteEmails(eventId: string, emails: string[]) {
  const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!list.length) throw new AppError('INVALID', 'Escribe al menos un correo');
  return db().begin(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (event.status !== 'open') throw new AppError('CLOSED', 'Ya se hizo el sorteo. Reabre las invitaciones para invitar a más personas.');
    const already = await tx<{ email: string }[]>`
      select email from participants where event_id = ${eventId} and email in ${tx(list)}`;
    const skip = new Set(already.map((r) => r.email));
    const toInvite = list.filter((e) => !skip.has(e));
    if (toInvite.length) {
      const [{ n }] = await tx<{ n: number }[]>`
        select count(*)::int as n from invitations where event_id = ${eventId} and email not in ${tx(toInvite)}`;
      if (n + toInvite.length > MAX_INVITATIONS_PER_EVENT)
        throw new AppError('INVALID', `Un evento puede tener máximo ${MAX_INVITATIONS_PER_EVENT} invitaciones.`);
    }
    const invited: Invitation[] = [];
    for (const email of toInvite) {
      const [inv] = await tx<Invitation[]>`
        insert into invitations ${tx({ eventId, email, token: newToken(), lastSentAt: new Date() })}
        on conflict (event_id, email) do update set
          token = case when invitations.status = 'pending' then invitations.token else excluded.token end,
          status = 'pending',
          created_at = now(),
          responded_at = null,
          last_sent_at = now()
        returning *`;
      invited.push(inv);
    }
    return { event, invited, alreadyIn: [...skip] };
  });
}

/** Para el organizador: invitaciones sin token (el token es el enlace del invitado). */
export async function listInvitations(eventId: string) {
  return db()<Omit<Invitation, 'token'>[]>`
    select id, event_id, email, status, created_at, responded_at, last_sent_at
    from invitations where event_id = ${eventId}
    order by created_at`;
}

/**
 * Marca el reenvío de una invitación pendiente, solo si el último envío fue hace
 * más de INVITATION_RESEND_COOLDOWN_MINUTES (evita reenvíos en ráfaga).
 */
export async function claimInvitationResend(eventId: string, invitationId: string): Promise<Invitation> {
  const [inv] = await db()<Invitation[]>`
    update invitations set last_sent_at = now()
    where id = ${invitationId} and event_id = ${eventId} and status = 'pending'
      and (last_sent_at is null
           or last_sent_at < now() - make_interval(mins => ${INVITATION_RESEND_COOLDOWN_MINUTES}))
    returning *`;
  if (inv) return inv;
  const [pending] = await db()`
    select 1 from invitations where id = ${invitationId} and event_id = ${eventId} and status = 'pending'`;
  if (!pending) throw new AppError('NOT_FOUND', 'Esa invitación ya no está pendiente.');
  throw new AppError(
    'RATE_LIMITED',
    `Ya se envió hace poco. Puedes reenviarla en unos minutos (cada ${INVITATION_RESEND_COOLDOWN_MINUTES} min).`,
  );
}

export async function revokeInvitation(eventId: string, invitationId: string) {
  const rows = await db()`
    update invitations set status = 'revoked', responded_at = now()
    where id = ${invitationId} and event_id = ${eventId} and status in ('pending', 'declined')
    returning id`;
  if (!rows.length) throw new AppError('NOT_FOUND', 'Esa invitación ya no se puede revocar');
}

export async function getInvitationByToken(token: string) {
  const [row] = await db()<(Invitation & { event: EventRow })[]>`
    select i.*, to_jsonb(e.*) as event
    from invitations i join events e on e.id = i.event_id
    where i.token = ${token}`;
  if (!row) return null;
  const { event, ...invitation } = row;
  return { invitation: invitation as Invitation, event: reviveEvent(event) };
}

export type Acceptance = { name: string; phone: string | null };

/** Acepta la invitación: crea al participante con el correo invitado. Nunca sortea. */
export async function acceptInvitation(token: string, input: Acceptance) {
  return db().begin(async (tx) => {
    const [found] = await tx<{ id: string; eventId: string }[]>`select id, event_id from invitations where token = ${token}`;
    if (!found) throw new AppError('NOT_FOUND', 'Esta invitación no existe');
    const event = await lockEvent(tx, found.eventId);
    const [inv] = await tx<Invitation[]>`select * from invitations where id = ${found.id} for update`;
    if (inv.status === 'accepted') throw new AppError('INVALID', 'Ya aceptaste esta invitación.');
    if (inv.status === 'revoked') throw new AppError('INVALID', 'El organizador canceló esta invitación.');
    await assertCanJoin(tx, event);

    const [dup] = await tx`select 1 from participants where event_id = ${event.id} and email = ${inv.email}`;
    if (dup) throw new AppError('EMAIL_TAKEN', 'Ese correo ya está registrado en este evento.');

    const [participant] = await tx<Participant[]>`
      insert into participants ${tx({ eventId: event.id, name: input.name, email: inv.email, phone: input.phone, accessToken: newToken() })}
      returning *`;
    await tx`update invitations set status = 'accepted', responded_at = now() where id = ${inv.id}`;
    return { participant, event };
  });
}

export async function declineInvitation(token: string) {
  const [inv] = await db()<Invitation[]>`
    update invitations set status = 'declined', responded_at = now()
    where token = ${token} and status = 'pending'
    returning *`;
  if (!inv) throw new AppError('INVALID', 'Esta invitación ya no está pendiente.');
  return inv;
}

export async function leaveEvent(participantId: string) {
  return db().begin(async (tx) => {
    const [p] = await tx<Participant[]>`select * from participants where id = ${participantId}`;
    if (!p) throw new AppError('NOT_FOUND', 'No existe');
    const event = await lockEvent(tx, p.eventId);
    if (event.status !== 'open') throw new AppError('CLOSED', 'Ya se hizo el sorteo; pídele al organizador que te quite.');
    if (p.isOrganizer) throw new AppError('INVALID', 'El organizador no puede salirse; puede borrar el evento.');
    const imgs = await tx<{ imagePath: string }[]>`
      select image_path from wishlist_items where participant_id = ${p.id} and image_path is not null`;
    await tx`delete from participants where id = ${p.id}`;
    return imgs.map((r) => r.imagePath);
  });
}

/**
 * Quita a alguien. Si ya había sorteo, se re-sortea (si quedan ≥3) para que el
 * ciclo no quede roto. Regresa imágenes a limpiar y si hubo nuevo sorteo.
 */
export async function removeParticipant(eventId: string, participantId: string) {
  return db().begin(async (tx) => {
    const event = await lockEvent(tx, eventId);
    const [p] = await tx<Participant[]>`
      select * from participants where id = ${participantId} and event_id = ${eventId}`;
    if (!p) throw new AppError('NOT_FOUND', 'Ese participante no está en el evento');
    const imgs = await tx<{ imagePath: string }[]>`
      select image_path from wishlist_items where participant_id = ${p.id} and image_path is not null`;
    const wasDrawn = event.status === 'drawn';
    if (wasDrawn) await resetDrawInTx(tx, eventId);
    await tx`delete from participants where id = ${p.id}`;
    let draw: DrawOutcome | null = null;
    if (wasDrawn) draw = await drawInTx(tx, { ...event, status: 'open' });
    return { imagePaths: imgs.map((r) => r.imagePath), wasDrawn, draw };
  });
}

// ───────────────────────── Exclusiones ─────────────────────────

export async function listExclusions(eventId: string) {
  return db()<{ aId: string; bId: string; aName: string; bName: string }[]>`
    select x.a_id, x.b_id, a.name as a_name, b.name as b_name
    from exclusions x
    join participants a on a.id = x.a_id
    join participants b on b.id = x.b_id
    where x.event_id = ${eventId}
    order by a.name, b.name`;
}

export async function addExclusion(eventId: string, x: string, y: string) {
  if (x === y) throw new AppError('INVALID', 'Elige dos personas distintas');
  const [a, b] = x < y ? [x, y] : [y, x];
  return db().begin(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (event.status !== 'open') throw new AppError('CLOSED', 'Reabre las invitaciones para cambiar exclusiones.');
    const rows = await tx`select id from participants where event_id = ${eventId} and id in ${tx([a, b])}`;
    if (rows.length !== 2) throw new AppError('INVALID', 'Participantes inválidos');
    await tx`insert into exclusions ${tx({ eventId, aId: a, bId: b })} on conflict do nothing`;
  });
}

export async function removeExclusion(eventId: string, a: string, b: string) {
  await db()`delete from exclusions where event_id = ${eventId} and a_id = ${a} and b_id = ${b}`;
}

// ───────────────────────── Sorteo ─────────────────────────

async function resetDrawInTx(tx: Sql, eventId: string) {
  await tx`delete from assignments where event_id = ${eventId}`;
  await tx`update events set status = 'open', drawn_at = null, reminder_sent_at = null where id = ${eventId}`;
}

async function drawInTx(tx: Sql, event: EventRow): Promise<DrawOutcome> {
  if (event.status !== 'open') return { drawn: false, reason: 'ALREADY_DRAWN', message: 'El sorteo ya se hizo.' };
  const people = await tx<{ id: string }[]>`select id from participants where event_id = ${event.id}`;
  if (people.length < MIN_PARTICIPANTS)
    return { drawn: false, reason: 'NOT_ENOUGH', message: `Se necesitan al menos ${MIN_PARTICIPANTS} participantes.` };
  const ex = await tx<{ aId: string; bId: string }[]>`select a_id, b_id from exclusions where event_id = ${event.id}`;
  let pairs;
  try {
    pairs = drawPairs(
      people.map((p) => p.id),
      ex.map((e) => [e.aId, e.bId] as [string, string]),
    );
  } catch (err) {
    if (err instanceof DrawError) return { drawn: false, reason: err.code, message: err.message };
    throw err;
  }
  await tx`insert into assignments ${tx(pairs.map((p) => ({ eventId: event.id, giverId: p.giverId, receiverId: p.receiverId })))}`;
  await tx`update events set status = 'drawn', drawn_at = now(), reminder_sent_at = null where id = ${event.id}`;
  return { drawn: true, count: pairs.length };
}

/** Sorteo atómico; seguro ante clics dobles o registros simultáneos. */
export async function performDraw(eventId: string) {
  return db().begin(async (tx) => drawInTx(tx, await lockEvent(tx, eventId)));
}

/** Borra el sorteo y vuelve a abrir el registro. */
export async function reopenEvent(eventId: string) {
  await db().begin(async (tx) => {
    await lockEvent(tx, eventId);
    await resetDrawInTx(tx, eventId);
  });
}

/** Rehace el sorteo con los participantes actuales. */
export async function redraw(eventId: string) {
  return db().begin(async (tx) => {
    const ev = await lockEvent(tx, eventId);
    await resetDrawInTx(tx, eventId);
    return drawInTx(tx, { ...ev, status: 'open' });
  });
}

export type Receiver = Pick<Participant, 'id' | 'name'>;

export async function getReceiverFor(giverId: string) {
  const [r] = await db()<Receiver[]>`
    select p.id, p.name from assignments a
    join participants p on p.id = a.receiver_id
    where a.giver_id = ${giverId}`;
  return r ?? null;
}

/** Para notificar resultados: cada quien con su amigo secreto. */
export async function listAssignments(eventId: string) {
  return db()<{ giver: Participant; receiverName: string }[]>`
    select to_jsonb(g.*) as giver, r.name as receiver_name
    from assignments a
    join participants g on g.id = a.giver_id
    join participants r on r.id = a.receiver_id
    where a.event_id = ${eventId}`.then((rows) => rows.map((r) => ({ ...r, giver: reviveParticipant(r.giver) })));
}

// ───────────────────────── Lista de deseos ─────────────────────────

export async function listItems(participantId: string) {
  return db()<WishItem[]>`
    select * from wishlist_items where participant_id = ${participantId} order by created_at`;
}

export type ItemInput = { title: string; note: string | null; url: string | null; estPriceMxn: number | null };

export async function addItem(participantId: string, input: ItemInput & { imagePath: string | null }) {
  const [n] = await db()<{ n: number }[]>`
    select count(*)::int as n from wishlist_items where participant_id = ${participantId}`;
  if (n.n >= 100) throw new AppError('INVALID', 'Máximo 100 cosas en la lista 🙂');
  const [item] = await db()<WishItem[]>`
    insert into wishlist_items ${db()({ participantId, ...input })} returning *`;
  return item;
}

/** Regresa la imagen anterior si se reemplazó o quitó, para borrarla del Storage. */
export async function updateItem(
  participantId: string,
  itemId: string,
  input: ItemInput & { imagePath?: string | null },
): Promise<{ item: WishItem; oldImagePath: string | null } | null> {
  return db().begin(async (tx) => {
    const [old] = await tx<WishItem[]>`
      select * from wishlist_items where id = ${itemId} and participant_id = ${participantId} for update`;
    if (!old) return null;
    const [item] = await tx<WishItem[]>`
      update wishlist_items set ${tx({ ...input, updatedAt: new Date() })}
      where id = ${itemId} returning *`;
    const replaced = input.imagePath !== undefined && old.imagePath && old.imagePath !== input.imagePath;
    return { item, oldImagePath: replaced ? old.imagePath : null };
  });
}

export async function deleteItem(participantId: string, itemId: string) {
  const [row] = await db()<{ imagePath: string | null }[]>`
    delete from wishlist_items where id = ${itemId} and participant_id = ${participantId}
    returning image_path`;
  return row ? row.imagePath : undefined;
}

// ───────────────────────── Notificaciones / cron ─────────────────────────

export async function logNotification(n: {
  eventId: string;
  participantId: string | null;
  kind: string;
  status: 'sent' | 'failed' | 'logged';
  error?: string | null;
}) {
  await db()`insert into notifications ${db()({ channel: 'email', error: null, ...n })}`;
}

export async function notificationStats(eventId: string) {
  return db()<{ kind: string; status: string; n: number; last: Date }[]>`
    select kind, status, count(*)::int as n, max(created_at) as last
    from notifications where event_id = ${eventId}
    group by kind, status order by max(created_at) desc`;
}

export async function eventsNeedingReminder(daysAhead = 3) {
  return db()<EventRow[]>`
    select * from events
    where status = 'drawn' and reminder_sent_at is null and event_at is not null
      and event_at > now() and event_at <= now() + make_interval(days => ${daysAhead})`;
}

/** Marca el recordatorio solo si nadie más lo marcó (idempotente). */
export async function claimReminder(eventId: string) {
  const rows = await db()`
    update events set reminder_sent_at = now() where id = ${eventId} and reminder_sent_at is null returning id`;
  return rows.length === 1;
}

export async function ping() {
  await db()`select 1`;
}

// ───────────────────────── Acceso con correo + código ─────────────────────────

export const LOGIN_CODE_TTL_MINUTES = 10;
const LOGIN_CODE_COOLDOWN_SECONDS = 60;
const LOGIN_CODE_MAX_ATTEMPTS = 5;
/** Tope de códigos por correo y evento en 24 h: limita el gasto de correo y la fuerza bruta. */
const LOGIN_CODE_MAX_PER_DAY = 8;

const hashCode = (eventId: string, code: string) => createHash('sha256').update(`${eventId}:${code}`).digest('hex');

/**
 * Genera un código de 6 dígitos para un participante del evento. Regresa null
 * si el correo no participa, si ya se pidió uno hace menos de un minuto (el
 * anterior sigue sirviendo) o si ya se pidieron demasiados hoy. Quien llama no
 * debe revelar cuál de los casos pasó.
 */
export async function issueLoginCode(eventId: string, email: string) {
  const mail = email.trim().toLowerCase();
  return db().begin(async (tx) => {
    const [participant] = await tx<Participant[]>`
      select * from participants where event_id = ${eventId} and email = ${mail} for update`;
    // Al usuario siempre le respondemos lo mismo; el motivo real solo va a los logs del servidor.
    const skip = (reason: string) => {
      console.info(`[login_code] evento ${eventId.slice(0, 8)} | ${mail.slice(0, 3)}***@${mail.split('@')[1]} | NO se emitió código: ${reason}`);
      return null;
    };
    if (!participant) return skip('no es participante (¿aceptó ya su invitación?)');
    const [stats] = await tx<{ recent: number; today: number }[]>`
      select
        count(*) filter (where created_at > now() - make_interval(secs => ${LOGIN_CODE_COOLDOWN_SECONDS}))::int as recent,
        count(*)::int as today
      from login_codes
      where event_id = ${eventId} and email = ${mail} and created_at > now() - interval '1 day'`;
    if (stats.recent > 0) return skip(`ya pidió uno hace menos de ${LOGIN_CODE_COOLDOWN_SECONDS} s`);
    if (stats.today >= LOGIN_CODE_MAX_PER_DAY) return skip(`llegó al límite de ${LOGIN_CODE_MAX_PER_DAY} códigos por día`);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await tx`update login_codes set used_at = now() where event_id = ${eventId} and email = ${mail} and used_at is null`;
    await tx`
      insert into login_codes (event_id, email, code_hash, expires_at)
      values (${eventId}, ${mail}, ${hashCode(eventId, code)}, now() + make_interval(mins => ${LOGIN_CODE_TTL_MINUTES}))`;
    return { participant, code };
  });
}

/** Valida el código; tras 5 intentos fallidos el código queda inutilizado. */
export async function verifyLoginCode(eventId: string, email: string, code: string): Promise<Participant> {
  const mail = email.trim().toLowerCase();
  const clean = code.replace(/\D/g, '');
  const invalid = new AppError('CODE_INVALID', 'El código no es correcto o ya venció. Revisa tu correo o pide uno nuevo.');
  if (clean.length !== 6) throw invalid;
  // El conteo de intentos debe guardarse aunque falle: por eso no lanzamos dentro de la transacción.
  const participant = await db().begin(async (tx) => {
    const [row] = await tx<{ id: string; codeHash: string; attempts: number }[]>`
      select id, code_hash, attempts from login_codes
      where event_id = ${eventId} and email = ${mail} and used_at is null and expires_at > now()
      order by created_at desc limit 1
      for update`;
    if (!row) return null;
    const ok = timingSafeEqual(Buffer.from(row.codeHash, 'hex'), Buffer.from(hashCode(eventId, clean), 'hex'));
    if (!ok) {
      const attempts = row.attempts + 1;
      await tx`
        update login_codes set attempts = ${attempts}
          ${attempts >= LOGIN_CODE_MAX_ATTEMPTS ? tx`, used_at = now()` : tx``}
        where id = ${row.id}`;
      return null;
    }
    await tx`update login_codes set used_at = now() where id = ${row.id}`;
    const [p] = await tx<Participant[]>`select * from participants where event_id = ${eventId} and email = ${mail}`;
    return p ?? null;
  });
  if (!participant) throw invalid;
  return participant;
}

/** Limpieza diaria de códigos viejos y contadores de límites vencidos. */
export async function purgeLoginCodes() {
  await db()`delete from login_codes where created_at < now() - interval '1 day'`;
  await db()`delete from rate_limits where window_start < now() - interval '1 day'`;
}

// ───────────────────────── Límites anti-abuso ─────────────────────────

/**
 * Suma `cost` al contador de `key` en la ventana fija actual de `windowSecs`
 * segundos y lanza RATE_LIMITED si pasa de `max`. Vive en Postgres para que
 * funcione igual en todas las instancias serverless.
 */
export async function hitRateLimit(key: string, max: number, windowSecs: number, cost = 1) {
  const [row] = await db()<{ count: number }[]>`
    insert into rate_limits (key, window_start, count)
    values (
      ${key},
      to_timestamp(floor(extract(epoch from now()) / ${windowSecs}::int) * ${windowSecs}::int),
      ${cost}::int
    )
    on conflict (key, window_start) do update set count = rate_limits.count + excluded.count
    returning count`;
  if (row.count > max) throw new AppError('RATE_LIMITED', 'Demasiados intentos seguidos. Espera un rato e intenta de nuevo.');
}

// ───────────────────────── Recuperar panel ─────────────────────────

/** Eventos recientes de un organizador, para reenviarle sus paneles. */
export async function eventsByOrganizerEmail(email: string, limit = 10) {
  return db()<EventRow[]>`
    select * from events where organizer_email = ${email.trim().toLowerCase()}
    order by created_at desc limit ${limit}`;
}

// ───────────────────────── helpers ─────────────────────────

// to_jsonb() devuelve snake_case y fechas como texto; las normalizamos.
function camelKeys(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]));
}
const toDate = (v: unknown) => (v == null ? null : new Date(v as string));

function reviveEvent(raw: unknown): EventRow {
  const e = camelKeys(raw as Record<string, unknown>) as unknown as EventRow;
  return {
    ...e,
    eventAt: toDate(e.eventAt),
    signupDeadline: toDate(e.signupDeadline),
    drawnAt: toDate(e.drawnAt),
    reminderSentAt: toDate(e.reminderSentAt),
    createdAt: toDate(e.createdAt)!,
  };
}

function reviveParticipant(raw: unknown): Participant {
  const p = camelKeys(raw as Record<string, unknown>) as unknown as Participant;
  return { ...p, createdAt: toDate(p.createdAt)! };
}
