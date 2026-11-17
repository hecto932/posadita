'use client';

import { useEffect, useRef } from 'react';

function getDialog(id: string) {
  return document.getElementById(id) as HTMLDialogElement | null;
}

/**
 * Diálogo modal nativo (`<dialog>` + showModal): atrapa el foco, cierra con Esc,
 * deja inerte el resto de la página y devuelve el foco al botón que lo abrió.
 * En celular ocupa toda la pantalla; desde `sm` es una hoja centrada.
 * Se queda montado al cerrarse, así que lo escrito no se pierde.
 * Si la URL trae `#<id>`, se abre solo.
 */
export function Modal({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && window.location.hash === `#${id}` && !dialog.open) dialog.showModal();
    // Con cacheComponents la ruta se oculta (Activity) en vez de desmontarse: un modal abierto
    // dejaría inerte la página siguiente, así que se cierra al ocultarse.
    return () => dialog?.close();
  }, [id]);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={`${id}-titulo`}
      aria-describedby={description ? `${id}-desc` : undefined}
      className="modal"
      onClose={() => {
        if (window.location.hash === `#${id}`) history.replaceState(history.state, '', window.location.pathname + window.location.search);
      }}
    >
      <div className="modal-encabezado">
        <div className="min-w-0">
          <h2 id={`${id}-titulo`} className="text-2xl font-extrabold">
            {title}
          </h2>
          {description && (
            <p id={`${id}-desc`} className="mt-1 text-cafe">
              {description}
            </p>
          )}
        </div>
        <button type="button" className="btn-ghost size-11 shrink-0 rounded-full p-0 text-xl" aria-label="Cerrar" onClick={() => ref.current?.close()}>
          <span aria-hidden>✕</span>
        </button>
      </div>
      <div className="modal-cuerpo">{children}</div>
    </dialog>
  );
}

/** Botón que abre un `<Modal>` por su id. */
export function OpenModalButton({ target, className = 'btn-primary', children }: { target: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} aria-haspopup="dialog" aria-controls={target} onClick={() => getDialog(target)?.showModal()}>
      {children}
    </button>
  );
}
