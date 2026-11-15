'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Error inesperado dentro de una página (p. ej. la base de datos no respondió). */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="card mt-8 text-center">
      <p className="text-5xl" aria-hidden>
        🪢
      </p>
      <h1 className="mt-3 text-2xl font-extrabold">Algo se nos enredó</h1>
      <p className="mt-1 text-cafe">No es tu culpa. Puede ser un problema momentáneo con el servidor; intenta de nuevo en unos segundos.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" onClick={() => retry()}>
          Reintentar
        </button>
        <Link href="/" className="btn-secondary">
          Ir al inicio
        </Link>
      </div>
      {error.digest && <p className="mt-4 text-sm text-cafe">Código del error: {error.digest}</p>}
    </div>
  );
}
