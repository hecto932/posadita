import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import './globals.css';
import { APP_NAME, APP_TAGLINE } from '@/lib/config';
import { PapelPicado } from '@/components/PapelPicado';

export const metadata: Metadata = {
  title: { default: `${APP_NAME} · ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: 'Organiza el amigo secreto de tu posada: un enlace, listas de deseos y sorteo secreto.',
};

export const viewport: Viewport = { themeColor: '#fff7ec' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-MX" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only rounded-full bg-tinta px-5 py-3 font-semibold text-crema focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Saltar al contenido
        </a>
        <PapelPicado />
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-3 pb-5">
          <Link href="/" className="rounded-lg font-display text-xl font-extrabold tracking-tight">
            {APP_NAME}
          </Link>
          <span className="hidden text-sm text-cafe sm:block">{APP_TAGLINE}</span>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 outline-none">{children}</main>
        <footer className="mx-auto w-full max-w-3xl px-4 pb-8 text-center text-sm text-cafe">
          Hecho con cariño para posadas, intercambios y reuniones · Montos en pesos mexicanos
        </footer>
      </body>
    </html>
  );
}
