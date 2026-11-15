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

export const metadata: Metadata = { title: 'Intercambio' };

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
  const cookieToken = (await cookies()).get(sessionCookie(slug))?.value;
  const me = cookieToken ? await svc.getParticipantByToken(cookieToken) : null;
  if (me && me.event.id === event.id) {
    return <ParticipantView participant={me.participant} event={me.event} token={me.participant.accessToken} welcome={!!sp.bienvenida} onEventPage />;
  }

  const names = await svc.listParticipantNames(event.id);

  return (
    <div className="space-y-6">
      {sp.salida && (
        <p role="status" className="aviso-info">
          <span aria-hidden className="aviso-icono">
            i
          </span>
          <span>Saliste del intercambio. Si cambias de opinión, pídele a {event.organizerName} que te vuelva a invitar.</span>
        </p>
      )}

      <section className="pt-2">
        <StatusBadge event={event} />
        <h1 className="mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">{event.name}</h1>
        <p className="mt-1 text-cafe">Organiza {event.organizerName}</p>
        <EventFacts event={event} className="mt-4" />
      </section>

      <section className="card" id="entrar">
        <h2 className="text-2xl font-extrabold">Entra al evento</h2>
        <p className="mt-2 mb-6 text-cafe">
          Este intercambio es <b>solo por invitación</b>. Escribe el correo con el que te invitaron y te mandamos un código para ver tu lista y, después del
          sorteo, a quién te tocó.
        </p>
        <CodeLogin requestCode={requestCodeAction.bind(null, slug)} verifyCode={verifyCodeAction.bind(null, slug)} />
        <p className="mt-5 text-sm text-cafe">
          ¿Te invitaron y aún no aceptas? Busca en tu correo el mensaje “te invita a {event.name}” y acéptalo primero.
        </p>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">Quiénes van</h2>
          <span className="chip">
            {names.length}
            {event.capacity ? ` de ${event.capacity}` : ''} {names.length === 1 ? 'persona' : 'personas'}
          </span>
        </div>
        {names.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {names.map((n, i) => (
              <li key={i} className="chip">
                {n}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-cafe">Todavía nadie ha aceptado su invitación.</p>
        )}
      </section>
    </div>
  );
}
