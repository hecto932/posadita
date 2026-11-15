'use client';

import { useState } from 'react';
import type { ActionState } from '@/app/actions';
import { ActionForm, SubmitButton } from './forms';

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Aceptar una invitación en dos pasos: nombre/WhatsApp → código que llega al
 * correo invitado. Así un enlace reenviado no basta para entrar.
 */
export function InviteAccept({ email, requestCode, accept }: { email: string; requestCode: FormAction; accept: FormAction }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  if (!codeSent) {
    return (
      <ActionForm action={requestCode} onSuccess={() => setCodeSent(true)} className="space-y-4">
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
        <p className="text-sm text-cafe">
          Para confirmar que eres tú, te mandaremos un código a <b>{email}</b>.
        </p>
        <SubmitButton pendingText="Enviando código…" className="btn-primary btn-lg w-full">
          Aceptar invitación 🎁
        </SubmitButton>
      </ActionForm>
    );
  }

  return (
    <div className="space-y-3">
      <ActionForm action={accept} className="space-y-3">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="phone" value={phone} />
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
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            className="input text-center font-display text-2xl tracking-[0.4em] placeholder:tracking-[0.4em]"
            placeholder="000000"
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
