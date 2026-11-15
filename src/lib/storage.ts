import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { MAX_IMAGE_BYTES, STORAGE_BUCKET } from './config';

let client: SupabaseClient | null = null;
function supabase() {
  const url = process.env.SUPABASE_URL;
  // Funciona con la "secret key" nueva (sb_secret_...) o la service_role legacy.
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SECRET_KEY para subir imágenes');
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client;
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' };

export function storageEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/** Sube la imagen y regresa su ruta dentro del bucket. */
export async function uploadImage(file: File, prefix: string): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new Error('Formato de imagen no soportado (usa JPG, PNG, WebP o GIF)');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('La imagen pesa más de 3 MB');
  const path = `${prefix}/${randomUUID()}.${ext}`;
  const { error } = await supabase()
    .storage.from(STORAGE_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
  return path;
}

export async function removeImages(paths: Array<string | null | undefined>) {
  const clean = paths.filter((p): p is string => Boolean(p));
  if (!clean.length || !storageEnabled()) return;
  const { error } = await supabase().storage.from(STORAGE_BUCKET).remove(clean);
  if (error) console.error('[storage] no se pudieron borrar imágenes', error.message);
}

/** El bucket es público; las rutas llevan UUID, así que no se pueden adivinar. */
export function imageUrl(path: string | null): string | null {
  if (!path || !process.env.SUPABASE_URL) return null;
  return `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}
