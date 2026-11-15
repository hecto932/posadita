-- Solo en Supabase: crea el bucket PRIVADO para las imágenes de las listas.
-- Las fotos solo se ven desde la app con enlaces firmados que caducan, así que
-- nadie fuera del evento puede abrirlas aunque consiga la URL.
-- (También puedes hacerlo a mano en Storage → New bucket → "wishlist", sin marcar Public.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist', 'wishlist', false, 3145728, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- Si el bucket ya existía como público, lo volvemos privado.
update storage.buckets set public = false where id = 'wishlist';
