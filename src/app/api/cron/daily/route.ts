import { timingSafeEqual } from 'node:crypto';
import { connection } from 'next/server';
import { notifyReminder } from '@/lib/notify';
import { deleteEvent, eventImagePaths, eventsNeedingReminder, expiredEventIds, ping, purgeLoginCodes } from '@/lib/service';
import { removeImagesOrThrow } from '@/lib/storage';

/**
 * Cron diario (vercel.json). Vercel Hobby solo permite 1 ejecución al día.
 * 1. Mantiene despierta la BD de Supabase (se pausa tras 7 días sin actividad).
 * 2. Manda recordatorio a eventos sorteados que son en ≤ 3 días.
 * 3. Borra códigos de acceso viejos.
 * 4. Borra por completo los eventos que ya pasaron (BD + fotos), sin guardar registro.
 * El sorteo NUNCA es automático: solo lo hace el organizador.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  await ping();
  let reminders = 0;
  for (const e of await eventsNeedingReminder(3)) reminders += await notifyReminder(e);
  await purgeLoginCodes();
  const { deleted, failed } = await purgeExpiredEvents();

  return Response.json({ ok: true, reminders, deleted, failed, at: new Date().toISOString() });
}

/**
 * Primero las fotos y luego la BD: si el Storage falla, el evento sigue ahí con
 * sus rutas y se reintenta mañana, en vez de dejar fotos huérfanas para siempre.
 */
async function purgeExpiredEvents() {
  let deleted = 0;
  let failed = 0;
  for (const id of await expiredEventIds()) {
    try {
      await removeImagesOrThrow(await eventImagePaths(id));
      await deleteEvent(id);
      deleted++;
    } catch (err) {
      failed++;
      console.error('[cron] no se pudo borrar un evento vencido', (err as Error).message);
    }
  }
  return { deleted, failed };
}

/** Comparación en tiempo constante para no filtrar el secreto por tiempos de respuesta. */
function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
