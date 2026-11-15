'use client';

import { useSyncExternalStore } from 'react';
import { CopyButton } from './forms';
import { WhatsAppIcon } from './icons';
import { waShare } from '@/lib/whatsapp';

/** Caja con el enlace (sin «https://» para que quepa) y botón para copiarlo completo. */
export function LinkBox({ url }: { url: string }) {
  const shown = url.replace(/^https?:\/\//, '');
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-crema p-2 pl-4">
      <span aria-hidden className="shrink-0">
        🔗
      </span>
      <code title={url} className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
        {shown}
      </code>
      <CopyButton text={url} className="btn-ghost shrink-0" />
    </div>
  );
}

const noop = () => () => {};
const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * WhatsApp (siempre) + «Compartir…» con el menú nativo del teléfono (solo si el
 * navegador lo soporta). El texto ya incluye el enlace.
 */
export function ShareButtons({ text, title, label = 'Avisar al grupo por WhatsApp' }: { text: string; title: string; label?: string }) {
  const nativeShare = useSyncExternalStore(noop, canShare, () => false);
  return (
    <div className="acciones">
      <a href={waShare(text)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp btn-lg sm:flex-1">
        <WhatsAppIcon />
        {label}
      </a>
      {nativeShare && (
        <button
          type="button"
          className="btn-secondary btn-lg"
          onClick={async () => {
            try {
              await navigator.share({ title, text });
            } catch {
              // La persona cerró el menú (AbortError) o el navegador lo bloqueó: no hay nada que hacer.
            }
          }}
        >
          <span aria-hidden>📤</span> Compartir…
        </button>
      )}
    </div>
  );
}
