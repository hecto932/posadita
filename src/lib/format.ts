import { randomBytes, randomInt } from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export { formatMXN, hostname } from './display';

export function formatDateTime(d: Date | null | undefined, timeZone: string): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(d);
}

export function formatDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeZone }).format(d);
}

/** "2026-12-18T20:00" interpretado en `timeZone` → Date (UTC). */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
        .formatToParts(new Date(t))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  let guess = asUtc - offset(asUtc);
  guess = asUtc - offset(guess); // corrige en cambios de horario
  return new Date(guess);
}

/** Date → "2026-12-18T20:00" en `timeZone`, para <input type="datetime-local">. */
export function utcToZonedLocal(d: Date | null | undefined, timeZone: string): string {
  if (!d) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Normaliza un teléfono (por defecto MX) a E.164. null si viene vacío; lanza si es inválido. */
export function normalizePhone(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  // Mucha gente aún escribe el "1" de celular previo a 2019: +52 1 XX XXXX XXXX.
  const digits = raw.replace(/\D/g, '');
  const fixed = /^521\d{10}$/.test(digits) ? `+52${digits.slice(3)}` : raw;
  const parsed = parsePhoneNumberFromString(fixed, 'MX');
  if (!parsed || !parsed.isValid()) throw new Error('El número de WhatsApp no parece válido');
  return parsed.number;
}

export function token(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function slug(len = 8): string {
  const b = randomBytes(len);
  return Array.from(b, (x) => SLUG_ALPHABET[x % SLUG_ALPHABET.length]).join('');
}

/** Número de evento de 6 dígitos (100000–999999), para entrar desde el inicio. */
export function eventCode(): number {
  return randomInt(100_000, 1_000_000);
}

/** "123 456" → 123456; null si no son exactamente 6 dígitos. */
export function parseEventCode(input: unknown): number | null {
  const digits = String(input ?? '').replace(/\s/g, '');
  return /^[1-9]\d{5}$/.test(digits) ? Number(digits) : null;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
