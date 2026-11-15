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

async function deliver(eventId: string, participantId: string | null, kind: string, mail: Mail) {
  const r = await sendMail(mail);
  if (r.status === 'failed') console.error(`[notify] ${kind} → ${mail.to}: ${r.error}`);
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
