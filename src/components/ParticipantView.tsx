import Link from 'next/link';
import { addItemAction, deleteItemAction, leaveEventAction, logoutAction, updateItemAction } from '@/app/actions';
import { EventFacts } from '@/components/EventBits';
import { ActionButton, CopyButton } from '@/components/forms';
import { WhatsAppIcon } from '@/components/icons';
import { MyItem } from '@/components/MyItem';
import { WishCard } from '@/components/WishCard';
import { WishItemForm } from '@/components/WishItemForm';
import { appUrl } from '@/lib/config';
import { formatMXN } from '@/lib/format';
import * as svc from '@/lib/service';
import { imageUrl } from '@/lib/storage';
import { waShare, waTo } from '@/lib/whatsapp';

const view = (i: svc.WishItem) => ({
  id: i.id,
  title: i.title,
  note: i.note,
  url: i.url,
  estPriceMxn: i.estPriceMxn,
  imageUrl: imageUrl(i.imagePath),
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
  onEventPage = false,
}: {
  participant: svc.Participant;
  event: svc.EventRow;
  token: string;
  welcome?: boolean;
  onEventPage?: boolean;
}) {
  const [myItems, receiver, count] = await Promise.all([
    svc.listItems(participant.id),
    event.status === 'drawn' ? svc.getReceiverFor(participant.id) : null,
    svc.countParticipants(event.id),
  ]);
  const receiverItems = receiver ? await svc.listItems(receiver.id) : [];

  const myUrl = appUrl(`/p/${token}`);
  const canLeave = event.status === 'open' && !participant.isOrganizer;
  const selfMsg = `🎁 Mi enlace personal para "${event.name}" (no lo compartas): ${myUrl}`;

  return (
    <div className="space-y-8">
      {welcome && (
        <section className="rounded-3xl border-2 border-verde-texto bg-verde-suave p-6">
          <h2 className="text-xl font-bold text-verde-texto">¡Ya estás dentro, {participant.name}! 🎉</h2>
          <p className="mt-1">
            Cuando quieras volver, entra a la página del evento con tu correo. También te mandamos tu enlace personal por correo y puedes guardarlo en tu
            WhatsApp:
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={participant.phone ? waTo(participant.phone, selfMsg) : waShare(selfMsg)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
              <WhatsAppIcon />
              Mandármelo por WhatsApp
            </a>
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
                <WishCard key={i.id} item={view(i)} maxAmount={event.maxAmountMxn} />
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
                item={view(i)}
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

      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold">Tu enlace personal</h2>
          <p className="mt-1 text-cafe">Guárdalo para volver a entrar sin código. No lo compartas.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <CopyButton text={myUrl} label="Copiar enlace" />
          <a href={participant.phone ? waTo(participant.phone, selfMsg) : waShare(selfMsg)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
            <WhatsAppIcon />
            Guardar en WhatsApp
          </a>
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
