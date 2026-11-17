'use client';

import { useState } from 'react';
import type { ActionState } from '@/app/actions';
import { CODE_DIGITS } from '@/lib/config';
import { ActionForm, Honeypot, SubmitButton } from './forms';

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Entrar al evento en dos pasos: datos → código que llega al correo.
 * - Con `email` (invitación directa): el correo es el invitado y no se puede cambiar.
 *   Así un enlace reenviado no basta para entrar.
 * - Sin `email` (enlace genérico para unirse): la persona escribe su correo y lo confirma con el código.
 */
export function InviteAccept({
  email: fixedEmail,
  requestCode,
  accept,
  submitLabel = 'Aceptar invitación 🎁',
}: {
  email?: string;
  requestCode: FormAction;
  accept: FormAction;
  submitLabel?: string;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [typedEmail, setTypedEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const email = fixedEmail ?? typedEmail.trim().toLowerCase();

  if (!codeSent) {
    return (
      <ActionForm action={requestCode} onSuccess={() => setCodeSent(true)} className="space-y-4">
        {!fixedEmail && <Honeypot />}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Tu nombre
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={80}
              className="input"
              placeholder="Como te conocen en la familia 🙂"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              WhatsApp <span className="opcional">(opcional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              className="input"
              placeholder="662 123 4567"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        {fixedEmail ? (
          <p className="text-sm text-cafe">
            Para confirmar que eres tú, te mandaremos un código a <b>{fixedEmail}</b>.
          </p>
        ) : (
          <div>
            <label className="label" htmlFor="email">
              Tu correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
              className="input"
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
              aria-describedby="email-hint"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
            />
            <p id="email-hint" className="hint mt-1">
              Te mandaremos un código para confirmarlo. Con este correo entrarás después y te llegará el resultado del sorteo.
            </p>
          </div>
        )}
        <SubmitButton pendingText="Enviando código…" className="btn-primary btn-lg w-full">
          {submitLabel}
        </SubmitButton>
      </ActionForm>
    );
  }

  return (
    <div className="space-y-3">
      <ActionForm action={accept} className="space-y-3">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="phone" value={phone} />
        {!fixedEmail && <input type="hidden" name="email" value={email} />}
        <label className="label" htmlFor="invite-code">
          Código que te llegó a {email}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="invite-code"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern={`[0-9]{${CODE_DIGITS}}`}
            maxLength={CODE_DIGITS}
            className="input text-center font-display text-2xl tracking-[0.4em] placeholder:tracking-[0.4em]"
            placeholder={'0'.repeat(CODE_DIGITS)}
            autoFocus
          />
          <SubmitButton pendingText="Revisando…" className="btn-primary shrink-0">
            Entrar 🎁
          </SubmitButton>
        </div>
      </ActionForm>
      <button type="button" className="btn-ghost" onClick={() => setCodeSent(false)}>
        Corregir mis datos o pedir un código nuevo
      </button>
    </div>
  );
}
