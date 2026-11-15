import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { acceptInvitationAction, declineInvitationAction, requestInviteCodeAction } from '@/app/actions';
import { EventFacts, Skeleton } from '@/components/EventBits';
import { ActionButton } from '@/components/forms';
import { InviteAccept } from '@/components/InviteAccept';
import * as svc from '@/lib/service';

export const metadata: Metadata = { title: 'Tu invitación', robots: { index: false, follow: false } };

export default function InvitationPage({ params }: PageProps<'/i/[token]'>) {
  return (
    <Suspense fallback={<Skeleton />}>
      <InvitationContent params={params} />
    </Suspense>
  );
}

async function InvitationContent({ params }: Pick<PageProps<'/i/[token]'>, 'params'>) {
  const { token } = await params;
  const found = await svc.getInvitationByToken(token);
  if (!found) notFound();
  const { invitation, event } = found;

  const count = await svc.countParticipants(event.id);
  const full = event.capacity != null && count >= event.capacity;
  const pastDeadline = event.signupDeadline != null && event.signupDeadline < new Date();
  const closedReason =
    event.status === 'drawn'
      ? '🎲 El sorteo ya se hizo, así que ya no se puede entrar.'
      : full
        ? '🙌 El grupo ya está completo.'
        : pastDeadline
          ? '⏰ Ya pasó la fecha límite para aceptar.'
          : null;

  return (
    <div className="space-y-6">
      <section className="pt-2">
        <span className="chip-rosa">💌 Invitación</span>
        <h1 className="mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">{event.name}</h1>
        <p className="mt-1 text-cafe">
          {event.organizerName} invitó a <b>{invitation.email}</b>
        </p>
        <EventFacts event={event} className="mt-4" />
        {event.description && <p className="mt-4 max-w-prose whitespace-pre-line">{event.description}</p>}
      </section>

      {invitation.status === 'accepted' ? (
        <section className="card text-center">
          <p className="text-lg font-bold">✅ Ya aceptaste esta invitación.</p>
          <p className="mt-2 text-cafe">Entra a la página del evento con tu correo para ver tu lista.</p>
          <Link href={`/e/${event.slug}`} className="btn-primary mt-5">
            Ir al evento →
          </Link>
        </section>
      ) : invitation.status === 'revoked' ? (
        <section className="card text-center">
          <p className="text-lg font-bold">Esta invitación fue cancelada.</p>
          <p className="mt-2 text-cafe">Si crees que es un error, habla con {event.organizerName}.</p>
        </section>
      ) : closedReason ? (
        <section className="card text-center">
          <p className="text-lg font-bold">{closedReason}</p>
          <p className="mt-2 text-cafe">Si crees que es un error, habla con {event.organizerName}.</p>
        </section>
      ) : (
        <section className="card space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold">{invitation.status === 'declined' ? '¿Cambiaste de opinión?' : '¿Le entras?'}</h2>
            <p className="mt-2 text-cafe">
              {invitation.status === 'declined'
                ? 'Rechazaste esta invitación, pero todavía puedes aceptarla.'
                : 'Al aceptar entras al grupo, armas tu lista de deseos y participas cuando el organizador haga el sorteo.'}
            </p>
          </div>
          <InviteAccept
            email={invitation.email}
            requestCode={requestInviteCodeAction.bind(null, token)}
            accept={acceptInvitationAction.bind(null, token)}
          />
          {invitation.status === 'pending' && (
            <div className="border-t border-linea pt-4 text-center">
              <ActionButton action={declineInvitationAction.bind(null, token)} className="btn-ghost text-peligro" confirm="¿Seguro que no vas a participar?" pendingText="…">
                No voy a participar
              </ActionButton>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
