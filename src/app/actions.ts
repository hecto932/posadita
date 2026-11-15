'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { DEFAULT_TIMEZONE, MX_TIMEZONES, sessionCookie } from '@/lib/config';
import { normalizePhone, parseEventCode, zonedLocalToUtc } from '@/lib/format';
import {
  notifyAdminRecovery,
  notifyDrawResults,
  notifyInvitations,
  notifyInviteCode,
  notifyLoginCode,
  notifyNewLink,
  notifyOrganizer,
  notifyParticipantAccess,
  notifyRegistered,
} from '@/lib/notify';
import * as svc from '@/lib/service';
import { removeImages, storageEnabled, uploadImage } from '@/lib/storage';

export type ActionState = { ok: boolean; message: string } | null;

const ok = (message: string): ActionState => ({ ok: true, message });
const fail = (message: string): ActionState => ({ ok: false, message });

function errorMessage(err: unknown): string {
  if (err instanceof svc.AppError) return err.message;
  if (err instanceof z.ZodError) return err.issues[0]?.message ?? 'Datos inválidos';
  if (err instanceof Error && /WhatsApp|imagen|Formato/.test(err.message)) return err.message;
  console.error(err);
  return 'Algo salió mal. Intenta de nuevo.';
}

// ───────── validación ─────────

const text = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
    z.string().max(max, `${label}: máximo ${max} caracteres`).nullable(),
  );
const required = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : ''),
    z.string().min(min, `${label} es obligatorio`).max(max, `${label}: máximo ${max} caracteres`),
  );
const optInt = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? Number(v.replace(/[,$\s]/g, '')) : null),
    z.number(`${label} debe ser un número`).int(`${label} debe ser entero`).min(min, `${label}: mínimo ${min}`).max(max, `${label}: máximo ${max}`).nullable(),
  );
const email = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  z.email('El correo no parece válido').max(254),
);
const tz = z.preprocess(
  (v) => (MX_TIMEZONES.some((t) => t.id === v) ? v : DEFAULT_TIMEZONE),
  z.string(),
);
const httpUrl = z.preprocess(
  (v) => {
    if (typeof v !== 'string' || !v.trim()) return null;
    const s = v.trim();
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  },
  z
    .url({ protocol: /^https?$/, message: 'El enlace no parece válido' })
    .max(2000)
    .nullable(),
);

const eventFields = z.object({
  name: required(2, 120, 'El nombre del evento'),
  description: text(1000, 'Descripción'),
  location: text(200, 'Lugar'),
  eventAt: text(16, 'Fecha'),
  timezone: tz,
  maxAmountMxn: optInt(1, 1_000_000, 'El monto máximo').refine((n) => n != null, 'El monto máximo es obligatorio'),
  signupDeadline: text(16, 'Fecha límite'),
  capacity: optInt(3, 200, 'El cupo'),
});

function parseEventFields(fd: FormData) {
  const f = eventFields.parse(Object.fromEntries(fd));
  // Obligatoria: el evento y todos sus datos se borran solos unos días después de esta fecha.
  const eventAt = f.eventAt ? zonedLocalToUtc(f.eventAt, f.timezone) : null;
  if (!eventAt) throw new svc.AppError('INVALID', 'La fecha y hora del intercambio es obligatoria.');
  const signupDeadline = f.signupDeadline ? zonedLocalToUtc(f.signupDeadline, f.timezone) : null;
  if (signupDeadline && signupDeadline > eventAt)
    throw new svc.AppError('INVALID', 'La fecha límite para aceptar debe ser antes del evento.');
  return { ...f, maxAmountMxn: f.maxAmountMxn!, eventAt, signupDeadline };
}

const personFields = z.object({
  name: required(1, 80, 'Tu nombre'),
  email,
  phone: z.preprocess((v) => normalizePhone(typeof v === 'string' ? v : null), z.string().nullable()),
});

const MAX_INVITES_PER_BATCH = 50;

/** Separa una lista de correos escrita a mano (comas, espacios, saltos de línea o ";"). */
function parseEmailList(raw: unknown): string[] {
  const parts = String(raw ?? '')
    .split(/[\s,;]+/)
    .map((s) => s.trim().replace(/^<|>$/g, ''))
    .filter(Boolean);
  if (!parts.length) throw new svc.AppError('INVALID', 'Escribe al menos un correo');
  if (parts.length > MAX_INVITES_PER_BATCH)
    throw new svc.AppError('INVALID', `Máximo ${MAX_INVITES_PER_BATCH} correos a la vez`);
  const bad = parts.filter((p) => !email.safeParse(p).success);
  if (bad.length) throw new svc.AppError('INVALID', `Estos correos no parecen válidos: ${bad.slice(0, 5).join(', ')}`);
  return parts.map((p) => p.toLowerCase());
}

// ───────── anti-abuso ─────────

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/** IP del cliente. En Vercel, x-forwarded-for la pone la propia plataforma. */
async function clientIp() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}

/** Campo trampa invisible: las personas lo dejan vacío, muchos bots no. */
const HONEYPOT = 'website';
const isBot = (fd: FormData) => Boolean(String(fd.get(HONEYPOT) ?? '').trim());

/** Abre una sesión en este navegador. La cookie lleva un token de sesión (no el enlace personal). */
async function rememberParticipant(slug: string, participantId: string) {
  const session = await svc.createSession(participantId);
  (await cookies()).set(sessionCookie(slug), session, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: svc.SESSION_DAYS * DAY,
    path: '/',
  });
}

/** Cierra la sesión de este navegador (borra la cookie y la sesión en la BD). */
async function forgetParticipant(slug: string) {
  const jar = await cookies();
  const session = jar.get(sessionCookie(slug))?.value;
  if (session) await svc.deleteSession(session);
  jar.delete(sessionCookie(slug));
}

// ───────── crear evento ─────────

export async function createEventAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let adminToken: string;
  try {
    if (isBot(fd)) return fail('Algo salió mal. Intenta de nuevo.');
    await svc.hitRateLimit(`create:ip:${await clientIp()}`, 5, HOUR);
    const f = parseEventFields(fd);
    if (f.eventAt < new Date()) return fail('La fecha del intercambio ya pasó.');
    if (f.signupDeadline && f.signupDeadline < new Date())
      return fail('La fecha límite para aceptar ya pasó.');
    const org = personFields.parse({ name: fd.get('organizerName'), email: fd.get('organizerEmail'), phone: fd.get('organizerPhone') });
    // Cada evento manda un correo al organizador: que no se use para bombardear un correo ajeno.
    await svc.hitRateLimit(`create:email:${org.email}`, 5, DAY);
    const { event, organizer } = await svc.createEvent({
      ...f,
      organizerName: org.name,
      organizerEmail: org.email,
      organizerPhone: org.phone,
      organizerParticipates: fd.get('participates') === 'on',
    });
    if (organizer) await rememberParticipant(event.slug, organizer.id);
    after(() => notifyOrganizer(event, organizer));
    adminToken = event.adminToken;
  } catch (err) {
    return fail(errorMessage(err));
  }
  redirect(`/admin/${adminToken}?nuevo=1`);
}

// ───────── invitación: aceptar / rechazar ─────────

const acceptFields = personFields.pick({ name: true, phone: true });

/** Paso 1 de aceptar: valida nombre/WhatsApp y manda un código al correo invitado. */
export async function requestInviteCodeAction(inviteToken: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    acceptFields.parse(Object.fromEntries(fd));
    await svc.hitRateLimit(`code:ip:${await clientIp()}`, 10, HOUR);
    const { invitation, event, code } = await svc.issueInviteCode(inviteToken);
    if (!code) return ok(`Ya te mandamos un código a ${invitation.email} hace menos de un minuto. Usa ese (revisa también Spam).`);
    after(() => notifyInviteCode(event, invitation, code));
    return ok(`Te mandamos un código de 6 dígitos a ${invitation.email}. Revisa también Spam.`);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/** Paso 2 de aceptar: con el código del correo, entra al evento. */
export async function acceptInvitationAction(inviteToken: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let slug: string;
  try {
    const input = acceptFields.parse(Object.fromEntries(fd));
    await svc.hitRateLimit(`verify:ip:${await clientIp()}`, 30, HOUR);
    const { participant, event } = await svc.acceptInvitation(inviteToken, input, String(fd.get('code') ?? ''));
    await rememberParticipant(event.slug, participant.id);
    after(() => notifyRegistered(event, participant));
    slug = event.slug;
  } catch (err) {
    return fail(errorMessage(err));
  }
  redirect(`/e/${slug}?bienvenida=1`);
}

export async function declineInvitationAction(inviteToken: string): Promise<ActionState> {
  try {
    await svc.declineInvitation(inviteToken);
    refresh();
    return ok('Listo, avisamos que no vas a participar.');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// ───────── entrar al evento con correo + código ─────────
// Dos puertas, mismo flujo: la página del evento (/e/[slug]) y el inicio, con
// número de evento + correo. Quien organiza llega a su panel; quien participa,
// a su página del evento (con su amigo secreto si ya hubo sorteo).

const LOGIN_CODE_SENT = 'Si ese correo está en el evento, te llegó un código de 6 dígitos. Revisa también Spam.';

/** Manda el código si el correo es de alguien del evento. Responde lo mismo exista o no, para no revelar quién está. */
async function sendLoginCode(event: svc.EventRow | null, rawEmail: FormDataEntryValue | null): Promise<ActionState> {
  const mail = email.parse(rawEmail);
  await svc.hitRateLimit(`code:ip:${await clientIp()}`, 10, HOUR);
  if (event) {
    const issued = await svc.issueLoginCode(event.id, mail);
    if (issued) after(() => notifyLoginCode(event, issued.to, issued.code));
  }
  return ok(LOGIN_CODE_SENT);
}

/** Valida el código y regresa a dónde mandar a la persona (el redirect va fuera del try). */
async function finishLogin(event: svc.EventRow | null, fd: FormData): Promise<string> {
  const mail = email.parse(fd.get('email'));
  await svc.hitRateLimit(`verify:ip:${await clientIp()}`, 30, HOUR);
  if (!event) throw new svc.AppError('CODE_INVALID', 'El código no es correcto o ya venció. Revisa tu correo o pide uno nuevo.');
  const { participant, isOrganizer } = await svc.verifyLoginCode(event.id, mail, String(fd.get('code') ?? ''));
  if (participant) await rememberParticipant(event.slug, participant.id);
  return isOrganizer ? `/admin/${event.adminToken}` : `/e/${event.slug}`;
}

export async function requestCodeAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    return await sendLoginCode(await svc.getEventBySlug(slug), fd.get('email'));
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function verifyCodeAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let to: string;
  try {
    const event = await svc.getEventBySlug(slug);
    if (!event) throw new svc.AppError('NOT_FOUND', 'El evento no existe');
    to = await finishLogin(event, fd);
  } catch (err) {
    return fail(errorMessage(err));
  }
  redirect(to);
}

/** Número de evento escrito a mano ("123 456" también vale). */
function eventCodeFrom(fd: FormData): number {
  const code = parseEventCode(fd.get('eventCode'));
  if (code == null) throw new svc.AppError('INVALID', 'El número de evento tiene 6 dígitos.');
  return code;
}

/** Desde el inicio: número de evento + correo → código al correo. */
export async function requestHomeCodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (isBot(fd)) return ok(LOGIN_CODE_SENT);
    return await sendLoginCode(await svc.getEventByCode(eventCodeFrom(fd)), fd.get('email'));
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/** Desde el inicio: con el código del correo, al panel (organizador) o a la página del evento (participante). */
export async function verifyHomeCodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let to: string;
  try {
    to = await finishLogin(await svc.getEventByCode(eventCodeFrom(fd)), fd);
  } catch (err) {
    return fail(errorMessage(err));
  }
  redirect(to);
}

export async function logoutAction(slug: string): Promise<ActionState> {
  await forgetParticipant(slug);
  redirect(`/e/${slug}`);
}

// ───────── participante: lista de deseos ─────────

async function participantOrThrow(token: string) {
  const me = await svc.getParticipantByToken(token);
  if (!me) throw new svc.AppError('NOT_FOUND', 'Enlace inválido');
  return me;
}

const itemFields = z.object({
  title: required(1, 140, 'Qué quieres'),
  note: text(1000, 'Detalles'),
  url: httpUrl,
  estPriceMxn: optInt(0, 1_000_000, 'El precio'),
});

function imageFrom(fd: FormData): File | null {
  const f = fd.get('image');
  return f instanceof File && f.size > 0 ? f : null;
}

export async function addItemAction(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let uploaded: string | null = null;
  try {
    const { participant } = await participantOrThrow(token);
    const input = itemFields.parse(Object.fromEntries(fd));
    const image = imageFrom(fd);
    if (image) {
      if (!storageEnabled()) return fail('Las imágenes no están configuradas todavía (Supabase Storage).');
      uploaded = await uploadImage(image, `${participant.eventId}/${participant.id}`);
    }
    await svc.addItem(participant.id, { ...input, imagePath: uploaded });
    refresh();
    return ok('¡Agregado a tu lista!');
  } catch (err) {
    if (uploaded) await removeImages([uploaded]);
    return fail(errorMessage(err));
  }
}

export async function updateItemAction(token: string, itemId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let uploaded: string | null = null;
  try {
    const { participant } = await participantOrThrow(token);
    const input = itemFields.parse(Object.fromEntries(fd));
    const image = imageFrom(fd);
    let imagePath: string | null | undefined;
    if (image) {
      if (!storageEnabled()) return fail('Las imágenes no están configuradas todavía (Supabase Storage).');
      imagePath = uploaded = await uploadImage(image, `${participant.eventId}/${participant.id}`);
    } else if (fd.get('removeImage') === 'on') {
      imagePath = null;
    }
    const res = await svc.updateItem(participant.id, itemId, { ...input, ...(imagePath !== undefined && { imagePath }) });
    if (!res) throw new svc.AppError('NOT_FOUND', 'Ese elemento ya no existe');
    if (res.oldImagePath) after(() => removeImages([res.oldImagePath]));
    refresh();
    return ok('Guardado');
  } catch (err) {
    if (uploaded) await removeImages([uploaded]);
    return fail(errorMessage(err));
  }
}

export async function deleteItemAction(token: string, itemId: string): Promise<ActionState> {
  try {
    const { participant } = await participantOrThrow(token);
    const img = await svc.deleteItem(participant.id, itemId);
    if (img) after(() => removeImages([img]));
    refresh();
    return ok('Eliminado');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function leaveEventAction(token: string): Promise<ActionState> {
  let slug: string;
  try {
    const { participant, event } = await participantOrThrow(token);
    const imgs = await svc.leaveEvent(participant.id);
    after(() => removeImages(imgs));
    (await cookies()).delete(sessionCookie(event.slug)); // la sesión se borró junto con el participante
    slug = event.slug;
  } catch (err) {
    return fail(errorMessage(err));
  }
  redirect(`/e/${slug}?salida=1`);
}

/**
 * "Generar un enlace nuevo": el enlace personal anterior deja de servir y se
 * cierran todas las sesiones. Este navegador queda dentro y el enlace nuevo
 * solo se manda por correo (nunca se muestra a quien tenía el anterior).
 */
export async function rotateLinkAction(token: string): Promise<ActionState> {
  let slug: string;
  try {
    const { participant, event } = await participantOrThrow(token);
    await svc.hitRateLimit(`relink:p:${participant.id}`, 5, HOUR);
    const fresh = await svc.rotateAccessToken(participant.id);
    await rememberParticipant(event.slug, fresh.id);
    after(() => notifyNewLink(event, fresh));
    slug = event.slug;
  } catch (err) {
    return fail(errorMessage(err));
  }
  redirect(`/e/${slug}?enlace=nuevo`);
}

// ───────── organizador ─────────

const RECOVER_ADMIN_MSG = 'Si ese correo organizó algún evento, en un momento te llega el enlace a tu panel. Revisa también Spam.';

/** "¿Perdiste tu panel?": reenvía los paneles al correo del organizador. */
export async function recoverAdminAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    if (isBot(fd)) return ok(RECOVER_ADMIN_MSG);
    const mail = email.parse(fd.get('email'));
    await svc.hitRateLimit(`admin-recover:ip:${await clientIp()}`, 5, HOUR);
    await svc.hitRateLimit(`admin-recover:email:${mail}`, 3, HOUR);
    const events = await svc.eventsByOrganizerEmail(mail);
    if (events.length) after(() => notifyAdminRecovery(mail, events));
    // Misma respuesta exista o no, para no revelar quién organiza eventos.
    return ok(RECOVER_ADMIN_MSG);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

async function adminEventOrThrow(adminToken: string) {
  const e = await svc.getEventByAdminToken(adminToken);
  if (!e) throw new svc.AppError('NOT_FOUND', 'Enlace de organizador inválido');
  return e;
}

export async function inviteAction(adminToken: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    const emails = parseEmailList(fd.get('emails'));
    await svc.hitRateLimit(`invite:event:${e.id}`, 100, HOUR, emails.length);
    const { event, invited, alreadyIn } = await svc.inviteEmails(e.id, emails);
    if (invited.length) after(() => notifyInvitations(event, invited));
    refresh();
    const parts = [
      invited.length ? `Enviando ${invited.length} ${invited.length === 1 ? 'invitación' : 'invitaciones'}.` : null,
      alreadyIn.length ? `Ya participan: ${alreadyIn.join(', ')}.` : null,
    ];
    return ok(parts.filter(Boolean).join(' '));
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function resendInvitationAction(adminToken: string, invitationId: string): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    if (e.status !== 'open') return fail('Ya se hizo el sorteo.');
    const inv = await svc.claimInvitationResend(e.id, invitationId);
    after(() => notifyInvitations(e, [inv]));
    return ok('Invitación reenviada');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function revokeInvitationAction(adminToken: string, invitationId: string): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    await svc.revokeInvitation(e.id, invitationId);
    refresh();
    return ok('Invitación cancelada');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function updateEventAction(adminToken: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    const f = parseEventFields(fd);
    // Una fecha pasada por error haría que el evento se borre solo: solo se acepta si no cambió.
    if (+f.eventAt !== +(e.eventAt ?? 0) && f.eventAt < new Date()) return fail('La fecha del intercambio ya pasó.');
    await svc.updateEvent(e.id, f);
    refresh();
    return ok('Cambios guardados');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

async function drawAndNotify(e: svc.EventRow, outcome: svc.DrawOutcome): Promise<ActionState> {
  if (!outcome.drawn) return fail(outcome.message);
  after(() => notifyDrawResults({ ...e, status: 'drawn' }));
  refresh();
  return ok(`¡Sorteo listo! Enviando correos a ${outcome.count} personas.`);
}

export async function drawAction(adminToken: string): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    return await drawAndNotify(e, await svc.performDraw(e.id));
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function redrawAction(adminToken: string): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    return await drawAndNotify(e, await svc.redraw(e.id));
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function reopenAction(adminToken: string): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    await svc.reopenEvent(e.id);
    refresh();
    return ok('Invitaciones reabiertas. El sorteo anterior se borró.');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function resendDrawEmailsAction(adminToken: string): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    if (e.status !== 'drawn') return fail('Aún no hay sorteo.');
    await svc.hitRateLimit(`draw-resend:event:${e.id}`, 3, HOUR);
    after(() => notifyDrawResults(e));
    refresh();
    return ok('Reenviando correos del sorteo…');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function removeParticipantAction(adminToken: string, participantId: string): Promise<ActionState> {
  let notice: string;
  try {
    const e = await adminEventOrThrow(adminToken);
    const res = await svc.removeParticipant(e.id, participantId);
    after(async () => {
      await removeImages(res.imagePaths);
      if (res.draw?.drawn) await notifyDrawResults({ ...e, status: 'drawn' });
    });
    notice = !res.wasDrawn
      ? 'Participante eliminado.'
      : res.draw?.drawn
        ? 'Participante eliminado. Se rehízo el sorteo y se avisó a todos por correo.'
        : `Participante eliminado. El sorteo se canceló y las invitaciones quedaron abiertas: ${res.draw?.message ?? ''}`;
  } catch (err) {
    return fail(errorMessage(err));
  }
  // El botón desaparece junto con la persona; el aviso viaja en la URL.
  redirect(`/admin/${adminToken}?aviso=${encodeURIComponent(notice)}`);
}

/**
 * "Reenviar acceso": si alguien perdió su correo o su enlace, se le manda otra
 * vez a su correo registrado, con el mismo enlace. El aviso al organizador
 * nunca menciona a quién le tocó.
 */
export async function resendParticipantAccessAction(adminToken: string, participantId: string): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    const p = await svc.getEventParticipant(e.id, participantId);
    await svc.hitRateLimit(`access-resend:p:${p.id}`, 3, HOUR);
    after(() => notifyParticipantAccess(e, p));
    return ok(`Listo: le reenviamos su acceso a ${p.name} por correo.`);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/** El organizador invalida el enlace personal de alguien (p. ej. si se filtró); el nuevo le llega por correo. */
export async function resetParticipantLinkAction(adminToken: string, participantId: string): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    await svc.hitRateLimit(`relink:p:${participantId}`, 5, HOUR);
    const fresh = await svc.rotateAccessToken(participantId, e.id);
    after(() => notifyNewLink(e, fresh));
    refresh();
    return ok(`Listo: el enlace anterior ya no sirve y le mandamos uno nuevo a ${fresh.name} por correo.`);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function addExclusionAction(adminToken: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    const a = String(fd.get('a') ?? '');
    const b = String(fd.get('b') ?? '');
    if (!a || !b) return fail('Elige a dos personas');
    await svc.addExclusion(e.id, a, b);
    refresh();
    return ok('Exclusión agregada');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function removeExclusionAction(adminToken: string, a: string, b: string): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    await svc.removeExclusion(e.id, a, b);
    refresh();
    return ok('Exclusión eliminada');
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function deleteEventAction(adminToken: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const e = await adminEventOrThrow(adminToken);
    if (String(fd.get('confirmName') ?? '').trim() !== e.name) return fail('Escribe el nombre exacto del evento para confirmar.');
    const imgs = await svc.deleteEvent(e.id);
    after(() => removeImages(imgs));
  } catch (err) {
    return fail(errorMessage(err));
  }
  redirect('/?eliminado=1');
}
