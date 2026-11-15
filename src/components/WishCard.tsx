import { formatMXN, hostname } from '@/lib/display';

export type WishView = {
  id: string;
  title: string;
  note: string | null;
  url: string | null;
  estPriceMxn: number | null;
  imageUrl: string | null;
};

export function WishCard({ item, maxAmount, children }: { item: WishView; maxAmount: number; children?: React.ReactNode }) {
  const over = item.estPriceMxn != null && item.estPriceMxn > maxAmount;
  return (
    <article className="flex gap-4 rounded-2xl border border-linea bg-superficie p-4 sm:p-5">
      {item.imageUrl ? (
        <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-xl" aria-label={`Ver imagen de ${item.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt="" loading="lazy" className="size-22 rounded-xl object-cover sm:size-26" />
        </a>
      ) : (
        <div className="grid size-22 shrink-0 place-items-center rounded-xl bg-crema-2 text-4xl sm:size-26" aria-hidden>
          🎁
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-xl leading-tight font-bold break-words">{item.title}</h3>
        {item.note && <p className="mt-1 whitespace-pre-line text-cafe">{item.note}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.estPriceMxn != null && (
            <span className={over ? 'chip-aviso' : 'chip'}>
              {over && <span aria-hidden>⚠</span>}~{formatMXN(item.estPriceMxn)}
              {over && ' · arriba del monto'}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="chip-enlace"
            >
              🔗 {hostname(item.url)}
            </a>
          )}
        </div>
        {children}
      </div>
    </article>
  );
}
