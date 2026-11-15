import Link from 'next/link';
import { addItemAction, deleteItemAction, leaveEventAction, logoutAction, rotateLinkAction, updateItemAction } from '@/app/actions';
import { EventFacts } from '@/components/EventBits';
import { ActionButton, CopyButton } from '@/components/forms';
import { WhatsAppIcon } from '@/components/icons';
import { MyItem } from '@/components/MyItem';
import { WishCard } from '@/components/WishCard';
import { WishItemForm } from '@/components/WishItemForm';
import { appUrl } from '@/lib/config';
import { formatMXN } from '@/lib/format';
import * as svc from '@/lib/service';
import { signedImageUrls } from '@/lib/storage';
import { waTo } from '@/lib/whatsapp';

const view = (i: svc.WishItem, images: Map<string, string>) => ({
  id: i.id,
  title: i.title,
  note: i.note,
  url: i.url,
  estPriceMxn: i.estPriceMxn,
  imageUrl: i.imagePath ? (images.get(i.imagePath) ?? null) : null,
});

/**
 * Lo que ve un participante: su amigo secreto (si ya hubo sorteo), la lista de
 * deseos de esa persona y la suya. Se usa en /p/[token] y en /e/[slug] tras
 * entrar con correo + código.
 */
export async function ParticipantView({
  participant,
  event,
  token,
  welcome = false,
  newLink = false,
  onEventPage = false,
}: {
  participant: svc.Participant;
  event: svc.EventRow;
  token: string;
  welcome?: boolean;
  newLink?: boolean;
  onEventPage?: boolean;
}) {
  const [myItems, receiver, names] = await Promise.all([
    svc.listItems(participant.id),
    event.status === 'drawn' ? svc.getReceiverFor(participant.id) : null,
    svc.listParticipantNames(event.id),
  ]);
  const count = names.length;
  // Solo la lista de quien te tocó: nunca se cargan regalos de nadie más.
  const receiverItems = receiver ? await svc.listItems(receiver.id) : [];
  const images = await signedImageUrls([...myItems, ...receiverItems].map((i) => i.imagePath));

  const myUrl = appUrl(`/p/${token}`);
  const canLeave = event.status === 'open' && !participant.isOrganizer;
  const selfMsg = `🎁 Mi enlace personal para "${event.name}" (no lo compartas): ${myUrl}`;

  return (
    <div className="space-y-8">
      {newLink && (
        <p role="status" className="aviso-info">
          <span aria-hidden className="aviso-icono">
            i
          </span>
          <span>Listo: tu enlace anterior ya no sirve y se cerraron tus otras sesiones. Te mandamos el nuevo por correo.</span>
        </p>
      )}

      {welcome && (
        <section className="rounded-3xl border-2 border-verde-texto bg-verde-suave p-6">
          <h2 className="text-xl font-bold text-verde-texto">¡Ya estás dentro, {participant.name}! 🎉</h2>
          <p className="mt-1">
            Cuando quieras volver, entra a la página del evento con tu correo. También te mandamos tu enlace personal por correo
            {participant.phone ? ' y puedes guardarlo en tu WhatsApp' : ''}:
          </p>
          <div className="acciones mt-4">
            {participant.phone && (
              <a href={waTo(participant.phone, selfMsg)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                <WhatsAppIcon />
                Mandármelo por WhatsApp
              </a>
            )}
            <CopyButton text={myUrl} label="Copiar mi enlace" />
          </div>
        </section>
      )}

      <section>
        {!onEventPage && (
          <Link href={`/e/${event.slug}`} className="link">
            ← {event.name}
          </Link>
        )}
        {onEventPage && <p className="font-semibold text-cafe">{event.name}</p>}
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Hola, {participant.name}</h1>
        <EventFacts event={event} className="mt-3" />
        {onEventPage && event.description && <p className="mt-4 max-w-prose whitespace-pre-line">{event.description}</p>}
      </section>

      {receiver ? (
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl bg-rosa p-6 text-white shadow-[0_6px_0_var(--color-rosa-oscuro)] sm:p-8">
            <span aria-hidden className="pointer-events-none absolute -right-8 -bottom-10 size-44 rounded-full border-[2.5rem] border-rosa-oscuro" />
            <p className="relative text-sm font-bold tracking-[0.08em] uppercase">Tu amigo secreto es…</p>
            <p className="relative mt-2 font-display text-5xl leading-none font-extrabold break-words sm:text-6xl">{receiver.name}</p>
            <p className="relative mt-4 max-w-[30ch]">🤫 Que no se te escape. Regalo de hasta {formatMXN(event.maxAmountMxn)}.</p>
          </div>
          <h2 className="text-2xl font-extrabold">Lo que le gustaría a {receiver.name}</h2>
          {receiverItems.length ? (
            <div className="space-y-3">
              {receiverItems.map((i) => (
                <WishCard key={i.id} item={view(i, images)} maxAmount={event.maxAmountMxn} />
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border-2 border-dashed border-linea p-6 text-cafe">
              Todavía no agrega nada a su lista. Date una vuelta en unos días 😉
            </p>
          )}
        </section>
      ) : (
        <section className="card border-2 border-dashed shadow-none">
          <h2 className="text-xl font-bold">🎲 Aún no se hace el sorteo</h2>
          <p className="mt-2 text-cafe">
            Van {count}
            {event.capacity ? ` de ${event.capacity}` : ''}. {event.organizerName} hará el sorteo cuando estén todos. Te avisamos por correo.
          </p>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold">Mi lista de deseos</h2>
          <p className="mt-1 text-cafe">Agrega todo lo que quieras: ideas, enlaces o fotos. Quien te toque verá esta lista.</p>
        </div>
        {myItems.length > 0 && (
          <div className="space-y-3">
            {myItems.map((i) => (
              <MyItem
                key={i.id}
                item={view(i, images)}
                maxAmount={event.maxAmountMxn}
                updateAction={updateItemAction.bind(null, token, i.id)}
                deleteAction={deleteItemAction.bind(null, token, i.id)}
              />
            ))}
          </div>
        )}
        <div className="card">
          <h3 className="mb-5 text-xl font-bold">{myItems.length ? 'Agregar otra cosa' : 'Agrega tu primera idea'}</h3>
          <WishItemForm action={addItemAction.bind(null, token)} maxAmount={event.maxAmountMxn} />
        </div>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">Quiénes van</h2>
          <span className="chip">
            {count}
            {event.capacity ? ` de ${event.capacity}` : ''} {count === 1 ? 'persona' : 'personas'}
          </span>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {names.map((n, i) => (
            <li key={i} className="chip">
              {n}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold">Tu enlace personal</h2>
          <p className="mt-1 text-cafe">
            Guárdalo para volver a entrar sin código. No lo compartas: quien lo tenga puede ver a quién te tocó y su lista.
          </p>
        </div>
        <div className="acciones">
          {participant.phone && (
            <a href={waTo(participant.phone, selfMsg)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
              <WhatsAppIcon />
              Guardar en mi WhatsApp
            </a>
          )}
          <CopyButton text={myUrl} label="Copiar enlace" />
        </div>
        <div className="border-t border-linea pt-4">
          <p className="text-sm text-cafe">¿Lo compartiste por error? Genera uno nuevo: el anterior deja de servir y te mandamos el nuevo por correo.</p>
          <ActionButton
            action={rotateLinkAction.bind(null, token)}
            className="btn-ghost mt-2"
            confirm="Tu enlace actual dejará de servir y se cerrará la sesión en tus otros dispositivos. ¿Continuar?"
          >
            Generar un enlace nuevo
          </ActionButton>
        </div>
      </section>

      {(onEventPage || canLeave) && (
        <section className="flex flex-wrap items-center gap-3">
          {onEventPage && (
            <ActionButton action={logoutAction.bind(null, event.slug)} className="btn-ghost">
              Cerrar sesión
            </ActionButton>
          )}
          {canLeave && (
            <span className="ml-auto">
              <ActionButton
                action={leaveEventAction.bind(null, token)}
                className="btn-ghost text-peligro"
                confirm="¿Seguro que te quieres salir del intercambio? Se borrará tu lista."
              >
                Salirme del intercambio
              </ActionButton>
            </span>
          )}
        </section>
      )}
    </div>
  );
}
