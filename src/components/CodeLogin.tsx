'use client';

import { useState } from 'react';
import type { ActionState } from '@/app/actions';
import { ActionForm, SubmitButton } from './forms';

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Entrar al evento en dos pasos: correo → código de 6 dígitos. */
export function CodeLogin({ requestCode, verifyCode }: { requestCode: FormAction; verifyCode: FormAction }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!sentTo) {
    return (
      <ActionForm action={requestCode} onSuccess={() => setSentTo(email)}>
        <label className="label" htmlFor="login-email">
          Tu correo
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            placeholder="El correo con el que te invitaron"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <SubmitButton pendingText="Enviando…" className="btn-primary shrink-0">
            Mándame un código
          </SubmitButton>
        </div>
      </ActionForm>
    );
  }

  return (
    <div className="space-y-3">
      <p>
        Si <b>{sentTo}</b> está en el evento, te llegó un código de 6 dígitos (revisa también Spam).
      </p>
      <ActionForm action={verifyCode}>
        <input type="hidden" name="email" value={sentTo} />
        <label className="label" htmlFor="login-code">
          Código
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="login-code"
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
            Entrar
          </SubmitButton>
        </div>
      </ActionForm>
      <button type="button" className="btn-ghost" onClick={() => setSentTo(null)}>
        Usar otro correo o pedir un código nuevo
      </button>
    </div>
  );
}
