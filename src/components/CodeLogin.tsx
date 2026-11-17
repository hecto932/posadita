'use client';

import { useState } from 'react';
import type { ActionState } from '@/app/actions';
import { CODE_DIGITS } from '@/lib/config';
import { ActionForm, Honeypot, SubmitButton } from './forms';

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Entrar al evento en dos pasos: correo → código que llega al correo.
 * Con `askEventCode` (desde el inicio) también pide el número de evento.
 */
export function CodeLogin({
  requestCode,
  verifyCode,
  askEventCode = false,
}: {
  requestCode: FormAction;
  verifyCode: FormAction;
  askEventCode?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const cleanEventCode = eventCode.replace(/\s/g, '');

  if (!sentTo) {
    return (
      <ActionForm action={requestCode} onSuccess={() => setSentTo(email)} className="space-y-4">
        {askEventCode && (
          <>
            <Honeypot />
            <div>
              <label className="label" htmlFor="login-event-code">
                Número de evento
              </label>
              <input
                id="login-event-code"
                name="eventCode"
                required
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                className="input font-display tracking-[0.2em]"
                placeholder="123456"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
              />
            </div>
          </>
        )}
        <div>
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
              placeholder="El correo con el que te invitaron o te uniste"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <SubmitButton pendingText="Enviando…" className="btn-primary shrink-0">
              Mándame un código
            </SubmitButton>
          </div>
        </div>
      </ActionForm>
    );
  }

  return (
    <div className="space-y-3">
      <p>
        Si <b>{sentTo}</b> está en {askEventCode ? <>el evento <b>{cleanEventCode}</b></> : 'el evento'}, te llegó un código de {CODE_DIGITS} dígitos (revisa también
        Spam).
      </p>
      <ActionForm action={verifyCode}>
        <input type="hidden" name="email" value={sentTo} />
        {askEventCode && <input type="hidden" name="eventCode" value={cleanEventCode} />}
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
            pattern={`[0-9]{${CODE_DIGITS}}`}
            maxLength={CODE_DIGITS}
            className="input text-center font-display text-2xl tracking-[0.4em] placeholder:tracking-[0.4em]"
            placeholder={'0'.repeat(CODE_DIGITS)}
            autoFocus
          />
          <SubmitButton pendingText="Revisando…" className="btn-primary shrink-0">
            Entrar
          </SubmitButton>
        </div>
      </ActionForm>
      <button type="button" className="btn-ghost" onClick={() => setSentTo(null)}>
        {askEventCode ? 'Cambiar número, correo o pedir un código nuevo' : 'Usar otro correo o pedir un código nuevo'}
      </button>
    </div>
  );
}
