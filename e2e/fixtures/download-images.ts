/**
 * Descarga fotos reales (Lorem Picsum, licencia Unsplash) para las listas de deseos del e2e.
 * Se corre una vez: `npm run e2e:images`. Las fotos quedan en e2e/fixtures/images/ (ignorada por git).
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_COUNT, IMAGES_DIR, imageFile } from './people';

type PicsumPhoto = { id: string; author: string };

async function exists(p: string) {
  return stat(p).then(
    (s) => s.size > 0,
    () => false,
  );
}

async function main() {
  await mkdir(IMAGES_DIR, { recursive: true });
  const have = await Promise.all(Array.from({ length: IMAGE_COUNT }, (_, i) => exists(imageFile(i))));
  if (have.every(Boolean)) {
    console.log(`Fotos listas: ${IMAGE_COUNT} en ${path.relative(process.cwd(), IMAGES_DIR)}`);
    return;
  }
  const res = await fetch(`https://picsum.photos/v2/list?page=2&limit=${IMAGE_COUNT}`);
  if (!res.ok) throw new Error(`picsum list ${res.status}`);
  const photos = (await res.json()) as PicsumPhoto[];
  if (photos.length < IMAGE_COUNT) throw new Error(`picsum regresó solo ${photos.length} fotos`);

  let downloaded = 0;
  for (let i = 0; i < IMAGE_COUNT; i++) {
    const file = imageFile(i);
    if (await exists(file)) continue;
    const img = await fetch(`https://picsum.photos/id/${photos[i].id}/900/700.jpg`);
    if (!img.ok) throw new Error(`foto ${photos[i].id}: ${img.status}`);
    await writeFile(file, Buffer.from(await img.arrayBuffer()));
    downloaded++;
    process.stdout.write('.');
  }
  console.log(`\n${downloaded} fotos nuevas, ${IMAGE_COUNT} en total en ${path.relative(process.cwd(), IMAGES_DIR)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
