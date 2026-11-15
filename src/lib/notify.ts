import { adminRecoveryEmail, drawEmail, invitationEmail, loginCodeEmail, organizerEmail, registeredEmail, reminderEmail } from './emails';
import { sendMail, type Mail } from './mailer';
import {
  LOGIN_CODE_TTL_MINUTES,
  claimReminder,
  listAssignments,
  logNotification,
  type EventRow,
  type Invitation,
  type Participant,
} from './service';

/** "hector@gmail.com" → "hec***@gmail.com": suficiente para depurar sin llenar los logs de correos completos. */
export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 3)}***@${domain ?? '?'}`;
}

async function deliver(eventId: string, participantId: string | null, kind: string, mail: Mail) {
  const started = Date.now();
  const r = await sendMail(mail);
  const line = `[mail] ${kind} → ${maskEmail(mail.to)} | evento ${eventId.slice(0, 8)} | ${r.provider} | ${Date.now() - started} ms`;
  if (r.status === 'sent') console.info(`${line} | ✅ ENVIADO${r.response ? ` | ${r.response}` : ''}`);
  else if (r.status === 'logged') console.warn(`${line} | ⚠️ NO ENVIADO: faltan SMTP_USER/SMTP_PASS, solo se imprimió en consola`);
  else console.error(`${line} | ❌ FALLÓ: ${r.error}`);
  await logNotification({ eventId, participantId, kind, status: r.status, error: r.error ?? null }).catch((e) =>
    console.error('[notify] no se pudo registrar', e),
  );
  return r;
}

/** Ejecuta en lotes pequeños para no saturar Gmail SMTP. */
async function inBatches<T>(items: T[], size: number, fn: (x: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await Promise.allSettled(items.slice(i, i + size).map(fn));
}

export const notifyOrganizer = (e: EventRow, organizer: Participant | null) =>
  deliver(e.id, organizer?.id ?? null, 'organizer', organizerEmail(e, organizer));

export const notifyRegistered = (e: EventRow, p: Participant) =>
  deliver(e.id, p.id, 'registered', registeredEmail(e, p));

export const notifyLoginCode = (e: EventRow, p: Participant, code: string) =>
  deliver(e.id, p.id, 'login_code', loginCodeEmail(e, p, code, LOGIN_CODE_TTL_MINUTES));

export const notifyAdminRecovery = (to: string, events: EventRow[]) =>
  deliver(events[0].id, null, 'admin_recovery', adminRecoveryEmail(to, events));

export async function notifyInvitations(e: EventRow, invs: Invitation[]) {
  await inBatches(invs, 3, (inv) => deliver(e.id, null, 'invitation', invitationEmail(e, inv)));
}

export async function notifyDrawResults(e: EventRow) {
  const rows = await listAssignments(e.id);
  await inBatches(rows, 3, ({ giver, receiverName }) =>
    deliver(e.id, giver.id, 'draw', drawEmail(e, giver, receiverName)),
  );
  return rows.length;
}

export async function notifyReminder(e: EventRow) {
  if (!(await claimReminder(e.id))) return 0;
  const rows = await listAssignments(e.id);
  await inBatches(rows, 3, ({ giver, receiverName }) =>
    deliver(e.id, giver.id, 'reminder', reminderEmail(e, giver, receiverName)),
  );
  return rows.length;
}
