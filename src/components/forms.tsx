'use client';

import { createContext, useActionState, useContext, useEffect, useRef, useState, useTransition } from 'react';
import type { ActionState } from '@/app/actions';

const Pending = createContext(false);

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Formulario para server actions que:
 * - NO borra lo escrito si hubo error (React 19 resetea con `action=`; aquí no).
 * - Permite transformar el FormData antes de enviar (p. ej. reducir imágenes).
 * - Muestra el mensaje de éxito/error debajo.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  transform,
  onSuccess,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  transform?: (fd: FormData) => Promise<FormData>;
  onSuccess?: () => void;
}) {
  const [state, dispatch, pending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        let fd = new FormData(e.currentTarget);
        if (transform) fd = await transform(fd);
        startTransition(() => dispatch(fd));
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      <FormMessage state={pending ? null : state} />
    </form>
  );
}

export function SubmitButton({
  children,
  pendingText = 'Un momento…',
  className = 'btn-primary',
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const pending = useContext(Pending);
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? 'status' : 'alert'} className={`mt-3 ${state.ok ? 'aviso-exito' : 'aviso-error'}`}>
      <span aria-hidden className="aviso-icono">
        {state.ok ? '✓' : '!'}
      </span>
      <span>{state.message}</span>
    </p>
  );
}

/** Botón suelto que dispara una server action sin campos (ya trae sus args con .bind). */
export function ActionButton({
  action,
  children,
  className = 'btn-secondary',
  confirm,
  pendingText = 'Un momento…',
}: {
  action: () => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  pendingText?: string;
}) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-stretch sm:items-start">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => setState(await action()));
        }}
      >
        {pending ? pendingText : children}
      </button>
      <FormMessage state={pending ? null : state} />
    </span>
  );
}

export function CopyButton({ text, label = 'Copiar', className = 'btn-secondary' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt('Copia el enlace:', text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? '¡Copiado!' : label}
    </button>
  );
}

/** Selector de zona horaria; preselecciona la del navegador si es de México. */
export function TimezoneSelect({ zones, defaultValue }: { zones: readonly { id: string; label: string }[]; defaultValue?: string }) {
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (defaultValue || !ref.current) return;
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zones.some((z) => z.id === local)) ref.current.value = local;
  }, [defaultValue, zones]);
  return (
    <select ref={ref} id="timezone" name="timezone" className="input" defaultValue={defaultValue ?? zones[0].id}>
      {zones.map((z) => (
        <option key={z.id} value={z.id}>
          {z.label}
        </option>
      ))}
    </select>
  );
}

/** Campo trampa anti-bots: invisible para personas y lectores de pantalla. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        No llenes este campo
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
