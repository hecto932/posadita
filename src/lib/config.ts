// Nombre de la app en un solo lugar: cámbialo aquí.
export const APP_NAME = 'Posadita';
export const APP_TAGLINE = 'Amigo secreto para posadas e intercambios';

/** Cookie de sesión del participante en la página de un evento. */
export const sessionCookie = (slug: string) => `posadita_${slug}`;

export const DEFAULT_TIMEZONE = 'America/Mexico_City';
export const MIN_PARTICIPANTS = 3;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const STORAGE_BUCKET = 'wishlist';

export function appUrl(path = ''): string {
  const base =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000');
  return `${base.replace(/\/$/, '')}${path}`;
}

export const MX_TIMEZONES = [
  { id: 'America/Mexico_City', label: 'Centro (CDMX, GDL, MTY)' },
  { id: 'America/Cancun', label: 'Sureste (Cancún)' },
  { id: 'America/Mazatlan', label: 'Pacífico (Mazatlán, La Paz)' },
  { id: 'America/Hermosillo', label: 'Sonora (Hermosillo)' },
  { id: 'America/Tijuana', label: 'Noroeste (Tijuana)' },
] as const;
