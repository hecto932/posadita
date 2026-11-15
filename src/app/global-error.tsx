'use client';

/**
 * Último recurso: reemplaza al layout raíz si este falla. No carga los estilos
 * globales, por eso todo va en línea.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es-MX">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fff7ec', color: '#2b1a12', fontFamily: 'system-ui, sans-serif' }}>
        <title>Algo salió mal · Posadita</title>
        <main role="alert" style={{ maxWidth: 420, margin: 16, padding: 28, textAlign: 'center', background: '#fff', border: '1px solid #f1dcc4', borderRadius: 24 }}>
          <p style={{ fontSize: 48, margin: 0 }} aria-hidden>
            🪢
          </p>
          <h1 style={{ fontSize: 24, margin: '12px 0 4px' }}>Algo se nos enredó</h1>
          <p style={{ color: '#8a6a55', margin: 0 }}>Intenta de nuevo en unos segundos.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 20, padding: '10px 20px', border: 0, borderRadius: 999, background: '#e4007c', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            Reintentar
          </button>
          {error.digest && <p style={{ marginTop: 16, fontSize: 12, color: '#8a6a55' }}>Código del error: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
