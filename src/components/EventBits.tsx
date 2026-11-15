import { MX_TIMEZONES } from '@/lib/config';
import { formatDateTime, formatMXN, utcToZonedLocal } from '@/lib/format';
import type { EventRow } from '@/lib/service';
import { TimezoneSelect } from './forms';

export function EventFacts({ event, className = '' }: { event: EventRow; className?: string }) {
  const when = formatDateTime(event.eventAt, event.timezone);
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      <li className="chip-ok">💰 Máximo {formatMXN(event.maxAmountMxn)}</li>
      {when && <li className="chip">📅 {when}</li>}
      {event.location && <li className="chip">📍 {event.location}</li>}
    </ul>
  );
}

export function StatusBadge({ event }: { event: EventRow }) {
  return event.status === 'drawn' ? (
    <span className="chip-rosa">🎲 Sorteo hecho</span>
  ) : (
    <span className="chip-aviso">📝 Esperando sorteo</span>
  );
}

/** Campos del evento, compartidos entre "crear" y "editar". */
export function EventFields({ event }: { event?: EventRow }) {
  const tz = event?.timezone;
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="name">
          Nombre del evento
        </label>
        <input id="name" name="name" required minLength={2} maxLength={120} defaultValue={event?.name} className="input" placeholder="Posada de la familia López 2026" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="maxAmountMxn">
            Monto máximo del regalo (MXN)
          </label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center font-semibold text-cafe">$</span>
            <input id="maxAmountMxn" name="maxAmountMxn" required inputMode="numeric" pattern="[0-9,]*" defaultValue={event?.maxAmountMxn} className="input pl-8" placeholder="500" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="capacity">
            Cupo <span className="opcional">(opcional)</span>
          </label>
          <input id="capacity" name="capacity" type="number" min={3} max={200} defaultValue={event?.capacity ?? ''} className="input" aria-describedby="capacity-hint" placeholder="Ej. 12" />
          <p id="capacity-hint" className="hint">Al completarse ya no se pueden aceptar más invitaciones.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="eventAt">
            Fecha y hora del intercambio
          </label>
          <input id="eventAt" name="eventAt" type="datetime-local" defaultValue={event ? utcToZonedLocal(event.eventAt, event.timezone) : ''} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="signupDeadline">
            Fecha límite para aceptar invitación
          </label>
          <input id="signupDeadline" name="signupDeadline" type="datetime-local" defaultValue={event ? utcToZonedLocal(event.signupDeadline, event.timezone) : ''} className="input" aria-describedby="signupDeadline-hint" />
          <p id="signupDeadline-hint" className="hint">Opcional. Después de esta fecha ya no se aceptan invitaciones. El sorteo lo haces tú.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="location">
            Lugar <span className="opcional">(opcional)</span>
          </label>
          <input id="location" name="location" maxLength={200} defaultValue={event?.location ?? ''} className="input" placeholder="Casa de la abuela" />
        </div>
        <div>
          <label className="label" htmlFor="timezone">
            Zona horaria
          </label>
          <TimezoneSelect zones={MX_TIMEZONES} defaultValue={tz} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">
          Mensaje para los invitados <span className="opcional">(opcional)</span>
        </label>
        <textarea id="description" name="description" rows={2} maxLength={1000} defaultValue={event?.description ?? ''} className="input" placeholder="Traigan su taza para el ponche ☕" />
      </div>
    </div>
  );
}

export function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 motion-reduce:animate-none" aria-busy aria-label="Cargando">
      <div className="h-10 w-2/3 rounded-2xl bg-crema-2" />
      <div className="h-6 w-1/2 rounded-full bg-crema-2" />
      <div className="h-64 rounded-3xl bg-crema-2" />
    </div>
  );
}
