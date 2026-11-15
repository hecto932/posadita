-- Solo en Supabase: crea el bucket público para las imágenes de las listas.
-- (También puedes hacerlo a mano en Storage → New bucket → "wishlist" → Public.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist', 'wishlist', true, 3145728, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
