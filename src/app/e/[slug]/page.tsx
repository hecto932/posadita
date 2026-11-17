import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { requestCodeAction, verifyCodeAction } from '@/app/actions';
import { CodeLogin } from '@/components/CodeLogin';
import { EventFacts, Skeleton, StatusBadge } from '@/components/EventBits';
import { ParticipantView } from '@/components/ParticipantView';
import { sessionCookie } from '@/lib/config';
import * as svc from '@/lib/service';

export const metadata: Metadata = { title: 'Intercambio', robots: { index: false, follow: false } };

export default function EventPage({ params, searchParams }: PageProps<'/e/[slug]'>) {
  return (
    <Suspense fallback={<Skeleton />}>
      <EventContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EventContent({ params, searchParams }: Pick<PageProps<'/e/[slug]'>, 'params' | 'searchParams'>) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const event = await svc.getEventBySlug(slug);
  if (!event) notFound();

  // ¿Ya entró con su correo (o aceptó la invitación) en este navegador?
  const session = (await cookies()).get(sessionCookie(slug))?.value;
  const me = session ? await svc.getParticipantBySession(session) : null;
  if (me && me.event.id === event.id) {
    return (
      <ParticipantView
        participant={me.participant}
        event={me.event}
        token={me.participant.accessToken}
        welcome={!!sp.bienvenida}
        newLink={sp.enlace === 'nuevo'}
        onEventPage
      />
    );
  }

  // Sin sesión solo mostramos cuántos van: los nombres son para quienes ya están dentro.
  const count = await svc.countParticipants(event.id);

  return (
    <div className="space-y-6">
      {sp.salida && (
        <p role="status" className="aviso-info">
          <span aria-hidden className="aviso-icono">
            i
          </span>
          <span>Saliste del intercambio. Si cambias de opinión, pídele a {event.organizerName} que te vuelva a invitar o el enlace para unirte.</span>
        </p>
      )}

      <section className="pt-2">
        <StatusBadge event={event} />
        <h1 className="titulo-1 mt-3">{event.name}</h1>
        <p className="mt-1 text-cafe">Organiza {event.organizerName}</p>
        <EventFacts event={event} className="mt-4" />
      </section>

      <section className="card" id="entrar">
        <h2 className="text-2xl font-extrabold">Entra al evento</h2>
        <p className="mt-2 mb-6 text-cafe">
          Escribe el correo con el que te invitaron o te uniste y te mandamos un código para ver tu lista y, después del sorteo, a quién te tocó.
        </p>
        <CodeLogin requestCode={requestCodeAction.bind(null, slug)} verifyCode={verifyCodeAction.bind(null, slug)} />
        <p className="mt-5 text-sm text-cafe">
          ¿Aún no estás dentro? Si te invitaron, busca en tu correo el mensaje “te invita a {event.name}” y acéptalo primero. Si no, pídele a{' '}
          {event.organizerName} el enlace para unirte.
        </p>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">Quiénes van</h2>
          <span className="chip">
            {count}
            {event.capacity ? ` de ${event.capacity}` : ''} {count === 1 ? 'persona' : 'personas'}
          </span>
        </div>
        <p className="mt-2 text-cafe">
          {count ? 'Entra con tu correo para ver quiénes ya confirmaron.' : 'Todavía nadie se ha unido.'}
        </p>
      </section>
    </div>
  );
}
