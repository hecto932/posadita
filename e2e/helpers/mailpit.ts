import { expect } from '@playwright/test';
import { MAILPIT_URL } from './env';

export type MailSummary = { ID: string; Subject: string; To: Array<{ Address: string }> };
export type Mail = MailSummary & { Text: string; HTML: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MAILPIT_URL}/api/v1${path}`, init);
  if (!res.ok) throw new Error(`Mailpit ${init?.method ?? 'GET'} ${path} → ${res.status}`);
  // DELETE responde "ok" en texto plano; el resto es JSON.
  return (res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text()) as T;
}

export async function clearMailbox() {
  await api('/messages', { method: 'DELETE' });
}

/** Busca con la sintaxis de Mailpit, p. ej. `to:ana@x.test subject:"código"`. */
export async function searchMail(query: string): Promise<MailSummary[]> {
  const r = await api<{ messages: MailSummary[] }>(`/search?limit=1000&query=${encodeURIComponent(query)}`);
  return r.messages ?? [];
}

export async function getMail(id: string): Promise<Mail> {
  return api<Mail>(`/message/${id}`);
}

export async function totalMail(): Promise<number> {
  return (await api<{ total: number }>('/messages?limit=1')).total;
}

/** Los correos salen en `after()`: espera hasta que llegue el que buscamos (el más reciente). */
export async function waitForMail(to: string, subjectIncludes: string, timeout = 20_000): Promise<Mail> {
  let found: MailSummary | undefined;
  await expect
    .poll(
      async () => {
        const list = await searchMail(`to:${to}`);
        found = list.find((m) => m.Subject.includes(subjectIncludes));
        return Boolean(found);
      },
      { message: `correo "${subjectIncludes}" para ${to}`, timeout },
    )
    .toBe(true);
  return getMail(found!.ID);
}

/** Espera a que haya exactamente `count` correos que cumplan la búsqueda. */
export async function waitForCount(query: string, count: number, timeout = 60_000): Promise<MailSummary[]> {
  let list: MailSummary[] = [];
  await expect
    .poll(
      async () => {
        list = await searchMail(query);
        return list.length;
      },
      { message: `correos que cumplen ${query}`, timeout },
    )
    .toBe(count);
  return list;
}

/** Código de 6 dígitos al inicio del asunto ("123456 es tu código…"). */
export function extractCode(mail: Mail): string {
  const m = mail.Subject.match(/^(\d{6})\b/) ?? mail.Text.match(/\b(\d{6})\b/);
  if (!m) throw new Error(`Sin código en "${mail.Subject}"`);
  return m[1];
}

/** Primer enlace de la app que empieza con `pathPrefix` (p. ej. "/i/"), como ruta relativa. */
export function extractLink(mail: Mail, pathPrefix: string): string {
  const re = new RegExp(`https?://[^\\s"'<>]+?(${pathPrefix.replace(/\//g, '\\/')}[A-Za-z0-9_-]+)`);
  const m = mail.Text.match(re) ?? mail.HTML.match(re);
  if (!m) throw new Error(`Sin enlace ${pathPrefix} en "${mail.Subject}"`);
  return m[1];
}
