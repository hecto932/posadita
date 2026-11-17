import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { joinEventAction, requestJoinCodeAction } from '@/app/actions';
import { EventFacts, Skeleton } from '@/components/EventBits';
import { InviteAccept } from '@/components/InviteAccept';
import { sessionCookie } from '@/lib/config';
import * as svc from '@/lib/service';

export const metadata: Metadata = { title: 'Únete al intercambio', robots: { index: false, follow: false } };

/** Enlace genérico del evento: cualquiera que lo tenga puede unirse confirmando su correo. */
export default function JoinPage({ params }: PageProps<'/u/[token]'>) {
  return (
    <Suspense fallback={<Skeleton />}>
      <JoinContent params={params} />
    </Suspense>
  );
}

async function JoinContent({ params }: Pick<PageProps<'/u/[token]'>, 'params'>) {
  const { token } = await params;
  const event = await svc.getEventByJoinToken(token);
  if (!event) notFound();

  // ¿Ya está dentro en este navegador? Entonces no hay nada que llenar.
  const session = (await cookies()).get(sessionCookie(event.slug))?.value;
  const me = session ? await svc.getParticipantBySession(session) : null;
  const alreadyIn = !!me && me.event.id === event.id;

  const count = await svc.countParticipants(event.id);
  const full = event.capacity != null && count >= event.capacity;
  const pastDeadline = event.signupDeadline != null && event.signupDeadline < new Date();
  const closedReason =
    event.status === 'drawn'
      ? '🎲 El sorteo ya se hizo, así que ya no se puede entrar.'
      : full
        ? '🙌 El grupo ya está completo.'
        : pastDeadline
          ? '⏰ Ya pasó la fecha límite para unirse.'
          : null;

  return (
    <div className="space-y-6">
      <section className="pt-2">
        <span className="chip-rosa">🎁 Intercambio</span>
        <h1 className="titulo-1 mt-3">{event.name}</h1>
        <p className="mt-1 text-cafe">Organiza {event.organizerName}</p>
        <EventFacts event={event} className="mt-4" />
        {event.description && <p className="mt-4 max-w-prose whitespace-pre-line">{event.description}</p>}
      </section>

      {alreadyIn ? (
        <section className="card text-center">
          <p className="text-lg font-bold">✅ Ya estás en este intercambio.</p>
          <Link href={`/e/${event.slug}`} className="btn-primary mt-5">
            Ir al evento →
          </Link>
        </section>
      ) : closedReason ? (
        <section className="card text-center">
          <p className="text-lg font-bold">{closedReason}</p>
          <p className="mt-2 text-cafe">
            Si ya estabas dentro,{' '}
            <Link href={`/e/${event.slug}`} className="underline">
              entra con tu correo
            </Link>
            . Si crees que es un error, habla con {event.organizerName}.
          </p>
        </section>
      ) : (
        <section className="card space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold">¿Le entras?</h2>
            <p className="mt-2 text-cafe">
              {event.organizerName} te compartió este enlace. Al unirte armas tu lista de deseos y participas cuando se haga el sorteo.
            </p>
          </div>
          <InviteAccept
            requestCode={requestJoinCodeAction.bind(null, token)}
            accept={joinEventAction.bind(null, token)}
            submitLabel="Unirme al intercambio 🎁"
          />
          <p className="text-sm text-cafe">
            ¿Ya estabas dentro?{' '}
            <Link href={`/e/${event.slug}`} className="underline">
              Entra con tu correo
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
