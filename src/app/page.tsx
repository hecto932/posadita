import { createEventAction, recoverAdminAction, requestHomeCodeAction, verifyHomeCodeAction } from './actions';
import { CodeLogin } from '@/components/CodeLogin';
import { EventFields } from '@/components/EventBits';
import { ActionForm, Honeypot, SubmitButton } from '@/components/forms';

const STEPS = [
  { emoji: '💌', title: 'Invita por correo', text: 'Escribes los correos y a cada quien le llega su invitación.' },
  { emoji: '📝', title: 'Aceptan y arman su lista', text: 'Quien acepta entra al grupo y agrega ideas, enlaces e imágenes.' },
  { emoji: '🤫', title: 'Tú decides cuándo sortear', text: 'A cada quien le toca alguien distinto. Nadie más lo ve.' },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="pt-4 text-center sm:pt-8">
        <h1 className="titulo-portada mx-auto max-w-xl">
          El amigo secreto de tu posada, <span className="text-rosa">sin papelitos.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-cafe">
          Invitaciones por correo, listas de deseos y un sorteo que nadie puede espiar. Gratis.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#crear" className="btn-primary btn-lg">
            Organizar mi intercambio
          </a>
          <a href="#entrar" className="btn-secondary btn-lg">
            Entrar a mi evento
          </a>
        </div>
      </section>

      <section id="entrar" className="card scroll-mt-6">
        <h2 className="text-2xl font-extrabold">¿Ya estás en un intercambio?</h2>
        <p className="mt-2 mb-6 text-cafe">
          Escribe el <b>número de evento</b> y tu correo. Te mandamos un código para entrar: si organizas, llegas a tu panel; si participas, ves tu lista
          y, después del sorteo, a quién te tocó.
        </p>
        <CodeLogin askEventCode requestCode={requestHomeCodeAction} verifyCode={verifyHomeCodeAction} />
        <p className="mt-5 text-sm text-cafe">El número de evento (6 dígitos) viene en tu invitación y en los correos del evento.</p>
      </section>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-3xl border border-linea bg-superficie/70 p-5">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {s.emoji}
              </span>
              <span className="font-display text-sm font-bold text-cafe">Paso {i + 1}</span>
            </div>
            <h2 className="mt-2 text-lg font-bold">{s.title}</h2>
            <p className="mt-1 text-cafe">{s.text}</p>
          </li>
        ))}
      </ol>

      <section id="crear" className="card scroll-mt-6">
        <h2 className="text-2xl font-extrabold">Crea tu evento</h2>
        <p className="mt-2 mb-6 text-cafe">Tarda un minuto. Te mandamos tu panel de organizador por correo.</p>
        <ActionForm action={createEventAction} className="space-y-6">
          <Honeypot />
          <EventFields />
          <fieldset className="space-y-4 rounded-2xl bg-crema/70 p-4 sm:p-5">
            <legend className="font-display text-lg font-bold">Tus datos (organizador)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="organizerName">
                  Tu nombre
                </label>
                <input id="organizerName" name="organizerName" required maxLength={80} className="input" placeholder="Héctor" autoComplete="given-name" />
              </div>
              <div>
                <label className="label" htmlFor="organizerEmail">
                  Tu correo
                </label>
                <input id="organizerEmail" name="organizerEmail" type="email" required className="input" placeholder="tu@correo.com" autoComplete="email" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="organizerPhone">
                Tu WhatsApp <span className="opcional">(opcional)</span>
              </label>
              <input id="organizerPhone" name="organizerPhone" type="tel" inputMode="tel" className="input" placeholder="662 123 4567" autoComplete="tel" />
            </div>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="participates" defaultChecked className="checkbox" />
              <span>
                <b>Yo también participo</b> en el intercambio.
                <span className="mt-0.5 block text-sm text-cafe">Tranquilo: ser organizador no te deja ver quién le tocó a quién.</span>
              </span>
            </label>
          </fieldset>
          <SubmitButton pendingText="Creando…" className="btn-primary btn-lg w-full">
            Crear evento 🎉
          </SubmitButton>
        </ActionForm>
      </section>

      <details className="card py-3 sm:py-4">
        <summary className="font-bold">¿Ya creaste un evento y perdiste tu panel de organizador?</summary>
        <p className="mt-3 text-cafe">Escribe el correo con el que lo creaste y te mandamos el enlace a tu panel.</p>
        <ActionForm action={recoverAdminAction} className="mt-4 pb-2" resetOnSuccess>
          <Honeypot />
          <label className="label" htmlFor="recover-email">
            Tu correo
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input id="recover-email" name="email" type="email" required autoComplete="email" className="input" placeholder="tu@correo.com" />
            <SubmitButton pendingText="Enviando…" className="btn-secondary shrink-0">
              Mándamelo
            </SubmitButton>
          </div>
        </ActionForm>
      </details>
    </div>
  );
}
