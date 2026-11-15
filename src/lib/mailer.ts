import nodemailer, { type Transporter } from 'nodemailer';
import { APP_NAME } from './config';

export type Mail = { to: string; subject: string; html: string; text: string };
export type SendResult = { status: 'sent' | 'logged' | 'failed'; error?: string };

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
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: from(), ...mail }),
      });
      if (!res.ok) return { status: 'failed', error: `Resend ${res.status}: ${await res.text()}` };
      return { status: 'sent' };
    }
    const t = smtp();
    if (t) {
      await t.sendMail({ from: from(), ...mail });
      return { status: 'sent' };
    }
    console.info(`\n[mail:dev] → ${mail.to}\n  ${mail.subject}\n  ${mail.text.replace(/\n/g, '\n  ')}\n`);
    return { status: 'logged' };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}
