import nodemailer, { type Transporter } from 'nodemailer';
import { APP_NAME } from './config';

export type Mail = { to: string; subject: string; html: string; text: string };
export type MailProvider = 'resend' | 'smtp' | 'console';
export type SendResult = {
  status: 'sent' | 'logged' | 'failed';
  provider: MailProvider;
  error?: string;
  /** Respuesta del proveedor (p. ej. "250 2.0.0 OK ... gsmtp"), útil para depurar. */
  response?: string;
};

let transporter: Transporter | null = null;

function smtp(): Transporter | null {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    pool: true,
    maxConnections: 3,
  });
  return transporter;
}

function from() {
  return process.env.MAIL_FROM ?? `${APP_NAME} <${process.env.SMTP_USER ?? 'no-reply@localhost'}>`;
}

/**
 * Proveedores, en orden:
 * 1. Resend (si hay RESEND_API_KEY) — requiere dominio verificado.
 * 2. SMTP (Gmail con contraseña de aplicación) — costo cero.
 * 3. Consola — para desarrollo local sin credenciales.
 */
export async function sendMail(mail: Mail): Promise<SendResult> {
  const provider: MailProvider = process.env.RESEND_API_KEY ? 'resend' : smtp() ? 'smtp' : 'console';
  try {
    if (provider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: from(), ...mail }),
      });
      const body = await res.text();
      if (!res.ok) return { status: 'failed', provider, error: `Resend ${res.status}: ${body}` };
      return { status: 'sent', provider, response: body };
    }
    if (provider === 'smtp') {
      const info = await smtp()!.sendMail({ from: from(), ...mail });
      if (info.rejected?.length) {
        return { status: 'failed', provider, error: `Gmail rechazó el destinatario: ${info.response}` };
      }
      return { status: 'sent', provider, response: info.response };
    }
    console.info(`\n[mail:dev] → ${mail.to}\n  ${mail.subject}\n  ${mail.text.replace(/\n/g, '\n  ')}\n`);
    return { status: 'logged', provider };
  } catch (err) {
    const e = err as { message?: string; code?: string; responseCode?: number };
    const detail = [e.code, e.responseCode].filter(Boolean).join(' ');
    return { status: 'failed', provider, error: `${detail ? `[${detail}] ` : ''}${e.message ?? String(err)}` };
  }
}
