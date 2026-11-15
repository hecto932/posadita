import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  addExclusionAction,
  deleteEventAction,
  drawAction,
  inviteAction,
  redrawAction,
  removeExclusionAction,
  removeParticipantAction,
  reopenAction,
  resendDrawEmailsAction,
  resendInvitationAction,
  revokeInvitationAction,
  updateEventAction,
} from '@/app/actions';
import { EventFacts, EventFields, Skeleton, StatusBadge } from '@/components/EventBits';
import { ActionButton, ActionForm, CopyButton, SubmitButton } from '@/components/forms';
import { WhatsAppIcon } from '@/components/icons';
import { LinkBox, ShareButtons } from '@/components/Share';
import { appUrl, MIN_PARTICIPANTS } from '@/lib/config';
import { formatDateTime, formatMXN } from '@/lib/format';
import * as svc from '@/lib/service';
import { waTo } from '@/lib/whatsapp';

export const metadata: Metadata = { title: 'Panel del organizador', robots: { index: false, follow: false } };

export default function AdminPage({ params, searchParams }: PageProps<'/admin/[token]'>) {
  return (
    <Suspense fallback={<Skeleton />}>
      <AdminContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const KIND_LABEL: Record<string, string> = {
  organizer: 'Panel al organizador',
  registered: 'Bienvenida',
  draw: 'Resultado del sorteo',
  reminder: 'Recordatorio',
  invitation: 'Invitaciones',
  login_code: 'Códigos de acceso',
  admin_recovery: 'Recuperar panel',
};
const INVITE_LABEL: Record<svc.InvitationStatus, { text: string; cls: string }> = {
  pending: { text: '⏳ Pendiente', cls: 'chip-aviso' },
  accepted: { text: '✓ Aceptó', cls: 'chip-ok' },
  declined: { text: '✕ Rechazó', cls: 'chip-peligro' },
  revoked: { text: 'Cancelada', cls: 'chip text-cafe' },
};
const STATUS_LABEL: Record<string, string> = { sent: 'enviados', failed: 'fallaron', logged: 'solo en consola (sin SMTP)' };

async function AdminContent({ params, searchParams }: Pick<PageProps<'/admin/[token]'>, 'params' | 'searchParams'>) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const event = await svc.getEventByAdminToken(token);
  if (!event) notFound();

  const [people, invitations, exclusions, stats, mine] = await Promise.all([
    svc.listParticipants(event.id),
    svc.listInvitations(event.id),
    svc.listExclusions(event.id),
    svc.notificationStats(event.id),
    svc.getOrganizerParticipant(event.id),
  ]);

  const publicUrl = appUrl(`/e/${event.slug}`);
  const adminUrl = appUrl(`/admin/${token}`);
  const drawn = event.status === 'drawn';
  const pendingInvites = invitations.filter((i) => i.status === 'pending').length;
  const inviteMsg = [
    `🎄 ¡Intercambio "${event.name}"!`,
    `Regalo de hasta ${formatMXN(event.maxAmountMxn)}.`,
    event.eventAt ? `📅 ${formatDateTime(event.eventAt, event.timezone)}` : null,
    `Les mandé una invitación por correo: acéptenla para entrar y armar su lista de deseos.`,
    `Después pueden entrar con su correo aquí 👉 ${publicUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
  const drawnMsg = `🎲 ¡Ya se hizo el sorteo de "${event.name}"! Revisen su correo para ver quién les tocó, o entren con su correo aquí: ${publicUrl}`;
  const personalNudge = (name: string) =>
    `Hola ${name} 👋 Ya se hizo el sorteo de "${event.name}". Te llegó un correo con tu amigo secreto (revisa Spam). También puedes entrar con tu correo aquí: ${publicUrl}`;
  const bind = <A extends unknown[], R>(fn: (t: string, ...a: A) => R) => fn.bind(null, token) as (...a: A) => R;

  return (
    <div className="space-y-6">
      {sp.nuevo && (
        <section className="rounded-3xl border-2 border-verde-texto bg-verde-suave p-6">
          <h2 className="text-xl font-bold text-verde-texto">¡Evento creado! 🎉</h2>
          <p className="mt-1">
            Este es tu <b>panel de organizador</b>. Guárdalo: también te lo mandamos por correo. No lo compartas.
          </p>
          <div className="mt-4">
            <CopyButton text={adminUrl} label="Copiar enlace del panel" />
          </div>
        </section>
      )}

      {typeof sp.aviso === 'string' && (
        <p role="status" className="aviso-info">
          <span aria-hidden className="aviso-icono">
            i
          </span>
          <span>{sp.aviso.slice(0, 300)}</span>
        </p>
      )}

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge event={event} />
          <span className="chip">👑 Panel del organizador</span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{event.name}</h1>
        <EventFacts event={event} className="mt-3" />
        <nav aria-label="Accesos rápidos" className="mt-5 flex flex-wrap gap-3">
          <Link href={`/e/${event.slug}`} className="btn-secondary flex-1 basis-36 sm:flex-none">
            <span aria-hidden>👀</span> Ver página
          </Link>
          {mine && (
            <Link href={`/p/${mine.accessToken}`} className="btn-secondary flex-1 basis-36 sm:flex-none">
              <span aria-hidden>🎁</span> Mi lista
            </Link>
          )}
        </nav>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="card-title">
            <span className="paso">1</span> Invita al grupo
          </h2>
          <p className="mt-2 text-cafe">
            A cada correo le llega una invitación. Solo quienes la <b>aceptan</b> entran al evento.
          </p>
        </div>
        {drawn ? (
          <p className="aviso-info">Ya se hizo el sorteo. Para invitar a más, usa “Reabrir invitaciones” (abajo).</p>
        ) : (
          <ActionForm action={inviteAction.bind(null, token)} resetOnSuccess className="space-y-3">
            <label className="label" htmlFor="emails">
              Correos de los invitados
            </label>
            <textarea id="emails" name="emails" rows={3} required className="input" aria-describedby="emails-hint" placeholder={'ana@correo.com, beto@correo.com\ncarla@correo.com'} />
            <p id="emails-hint" className="hint">Sepáralos con comas o uno por renglón. Máximo 50 a la vez.</p>
            <SubmitButton pendingText="Invitando…" className="btn-primary w-full sm:w-auto">Enviar invitaciones 💌</SubmitButton>
          </ActionForm>
        )}
        {invitations.length > 0 && (
          <ul className="divide-y divide-linea">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{inv.email}</span>
                  <span className={`${INVITE_LABEL[inv.status].cls} shrink-0`}>{INVITE_LABEL[inv.status].text}</span>
                </div>
                {(inv.status === 'pending' || inv.status === 'declined') && (
                  <div className="flex flex-wrap gap-2">
                    {!drawn && inv.status === 'pending' && (
                      <ActionButton action={resendInvitationAction.bind(null, token, inv.id)} className="btn-ghost" pendingText="…">
                        Reenviar
                      </ActionButton>
                    )}
                    <ActionButton
                      action={revokeInvitationAction.bind(null, token, inv.id)}
                      className="btn-ghost text-peligro"
                      confirm={`¿Cancelar la invitación de ${inv.email}?`}
                      pendingText="…"
                    >
                      Cancelar
                    </ActionButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-4 border-t border-linea pt-5">
          <div>
            <h3 className="font-display text-lg font-bold">Comparte la página del evento</h3>
            <p className="mt-1 text-cafe">Cada invitado entra con su correo y un código.</p>
          </div>
          <LinkBox url={publicUrl} />
          <ShareButtons text={inviteMsg} title={event.name} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="card-title">
          <span className="paso">2</span> Participantes
          <span className="chip ml-auto">
            {people.length}
            {event.capacity ? ` de ${event.capacity}` : ''}
          </span>
        </h2>
        {people.length ? (
          <ul className="divide-y divide-linea">
            {people.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">
                    {p.name} {p.isOrganizer && <span className="text-sm font-medium text-cafe">(tú)</span>}
                  </p>
                  <p className="text-sm text-cafe [overflow-wrap:anywhere]">
                    {p.email}
                    {p.phone ? ` · ${p.phone}` : ''} · {p.itemCount} {p.itemCount === 1 ? 'deseo' : 'deseos'}
                  </p>
                </div>
                {!p.isOrganizer && (
                  <div className="flex flex-wrap gap-2">
                    {drawn && p.phone && (
                      <a href={waTo(p.phone, personalNudge(p.name))} target="_blank" rel="noopener noreferrer" className="btn-ghost text-whatsapp-enlace">
                        <WhatsAppIcon />
                        WhatsApp
                      </a>
                    )}
                    <ActionButton
                      action={removeParticipantAction.bind(null, token, p.id)}
                      className="btn-ghost text-peligro"
                      confirm={
                        drawn
                          ? `Quitar a ${p.name} rehace el sorteo y se avisa a todos de nuevo. ¿Continuar?`
                          : `¿Quitar a ${p.name} del intercambio?`
                      }
                    >
                      Quitar
                    </ActionButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-cafe">Aún no hay nadie. Invita por correo arriba; aquí aparecen quienes acepten.</p>
        )}
      </section>

      {!drawn && people.length >= 2 && (
        <section className="card space-y-4">
          <div>
            <h2 className="card-title">
              <span className="paso">3</span> Exclusiones <span className="opcional">(opcional)</span>
            </h2>
            <p className="mt-2 text-cafe">Personas que no deben tocarse entre sí, como parejas o hermanos.</p>
          </div>
          <ActionForm action={addExclusionAction.bind(null, token)}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
              <select name="a" aria-label="Persona que da el regalo" className="input" required defaultValue="">
                <option value="" disabled>
                  Persona
                </option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="text-center text-cafe">no le toca a</span>
              <select name="b" aria-label="Persona que no le debe tocar" className="input" required defaultValue="">
                <option value="" disabled>
                  Persona
                </option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <SubmitButton className="btn-secondary">Agregar</SubmitButton>
            </div>
          </ActionForm>
          {exclusions.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {exclusions.map((x) => (
                <li key={`${x.aId}-${x.bId}`} className="chip pr-1">
                  {x.aName} ⇄ {x.bName}
                  <ActionButton
                    action={removeExclusionAction.bind(null, token, x.aId, x.bId)}
                    className="grid size-9 place-items-center rounded-full text-cafe hover:bg-superficie hover:text-peligro"
                    pendingText="…"
                  >
                    <span aria-hidden>✕</span>
                    <span className="sr-only">
                      Quitar exclusión entre {x.aName} y {x.bName}
                    </span>
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="card-title">
          <span className="paso">{people.length >= 2 && !drawn ? 4 : 3}</span> {drawn ? 'Sorteo hecho 🎲' : 'Sorteo'}
        </h2>
        {drawn ? (
          <>
            <p>
              🗓️ Sorteo: {formatDateTime(event.drawnAt, event.timezone)}. A cada quien le llegó un correo con su amigo secreto. Tú tampoco puedes ver quién le tocó a
              quién. 🤫
            </p>
            <ShareButtons text={drawnMsg} title={event.name} />
            <div className="acciones">
              <ActionButton action={bind(resendDrawEmailsAction)} pendingText="Enviando…">
                Reenviar correos
              </ActionButton>
            </div>
            <details className="rounded-2xl bg-crema px-4 py-1">
              <summary className="font-semibold">Opciones avanzadas</summary>
              <div className="acciones pt-2 pb-4">
                <ActionButton action={bind(redrawAction)} confirm="Se hará un sorteo NUEVO y se avisará a todos otra vez. ¿Continuar?" pendingText="Sorteando…">
                  Rehacer sorteo
                </ActionButton>
                <ActionButton action={bind(reopenAction)} confirm="Se borrará el sorteo y podrás invitar a más personas. ¿Continuar?" pendingText="Reabriendo…">
                  Reabrir invitaciones
                </ActionButton>
              </div>
            </details>
          </>
        ) : (
          <>
            <p className="text-cafe">
              El sorteo <b>solo pasa cuando tú lo decidas</b>. Se hace entre quienes ya aceptaron (mínimo {MIN_PARTICIPANTS}) y se cierran las
              invitaciones.
              {pendingInvites > 0 && ` Ojo: todavía hay ${pendingInvites} ${pendingInvites === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}.`}
            </p>
            {people.length >= MIN_PARTICIPANTS ? (
              <div className="acciones">
                <ActionButton
                  action={bind(drawAction)}
                  className="btn-primary btn-lg"
                  confirm={`Se sorteará entre ${people.length} personas y se cerrarán las invitaciones. ¿Listo?`}
                  pendingText="Sorteando…"
                >
                  Hacer el sorteo ahora 🎲
                </ActionButton>
              </div>
            ) : (
              <p className="chip">Faltan {MIN_PARTICIPANTS - people.length} para poder sortear</p>
            )}
          </>
        )}
      </section>

      {stats.length > 0 && (
        <section className="card">
          <h2 className="card-title">Correos</h2>
          <ul className="mt-3 space-y-1">
            {stats.map((s) => (
              <li key={`${s.kind}-${s.status}`} className={s.status === 'failed' ? 'font-semibold text-peligro' : ''}>
                {KIND_LABEL[s.kind] ?? s.kind}: <b>{s.n}</b> {STATUS_LABEL[s.status] ?? s.status}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="card py-4 sm:py-5">
        <summary className="font-display text-xl font-bold">Editar detalles del evento</summary>
        <ActionForm action={updateEventAction.bind(null, token)} className="mt-4 space-y-5 pb-2">
          <EventFields event={event} />
          <SubmitButton pendingText="Guardando…" className="btn-primary w-full sm:w-auto">Guardar cambios</SubmitButton>
        </ActionForm>
      </details>

      <details className="card border-peligro/30 py-4 sm:py-5">
        <summary className="font-display text-xl font-bold text-peligro">Eliminar evento</summary>
        <ActionForm action={deleteEventAction.bind(null, token)} className="mt-4 space-y-3 pb-2">
          <label htmlFor="confirmName">Se borra todo: participantes, listas, imágenes y el sorteo. No se puede deshacer. Para confirmar, escribe el nombre del evento.</label>
          <input id="confirmName" name="confirmName" className="input" placeholder={`Escribe: ${event.name}`} required />
          <SubmitButton className="btn-danger w-full sm:w-auto" pendingText="Eliminando…">
            Eliminar para siempre
          </SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
