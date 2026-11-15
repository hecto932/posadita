'use client';

import { useCallback, useId, useRef, useState } from 'react';
import type { ActionState } from '@/app/actions';
import { ActionForm, SubmitButton } from './forms';

type Item = { title: string; note: string | null; url: string | null; estPriceMxn: number | null; imageUrl: string | null };

/** Reduce la imagen en el navegador (máx. 1600 px, WebP) para ahorrar Storage y datos. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}

async function transform(fd: FormData) {
  const img = fd.get('image');
  if (img instanceof File && img.size > 0) fd.set('image', await shrinkImage(img));
  return fd;
}

export function WishItemForm({
  action,
  item,
  maxAmount,
  onDone,
  submitLabel = 'Agregar a mi lista',
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  item?: Item;
  maxAmount: number;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [preview, setPreview] = useState<string | null>(item?.imageUrl ?? null);
  const [price, setPrice] = useState<string>(item?.estPriceMxn?.toString() ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const over = Number(price) > maxAmount;
  const reset = useCallback(() => {
    if (!item) {
      setPreview(null);
      setPrice('');
    }
    onDone?.();
  }, [item, onDone]);

  return (
    <ActionForm action={action} transform={transform} resetOnSuccess={!item} onSuccess={reset} className="space-y-4">
      <div>
        <label className="label" htmlFor={`${id}-t`}>
          ¿Qué te gustaría?
        </label>
        <input
          id={`${id}-t`}
          name="title"
          required
          maxLength={140}
          defaultValue={item?.title}
          className="input"
          placeholder="Ej. Una taza bonita, un libro, calcetines navideños…"
        />
      </div>
      <div>
        <label className="label" htmlFor={`${id}-n`}>
          Detalles <span className="opcional">(opcional)</span>
        </label>
        <textarea
          id={`${id}-n`}
          name="note"
          rows={2}
          maxLength={1000}
          defaultValue={item?.note ?? ''}
          className="input"
          placeholder="Talla, color, sabor favorito, lo que ayude…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <div>
          <label className="label" htmlFor={`${id}-u`}>
            Enlace <span className="opcional">(opcional)</span>
          </label>
          <input
            id={`${id}-u`}
            name="url"
            type="text"
            inputMode="url"
            defaultValue={item?.url ?? ''}
            className="input"
            placeholder="https://www.amazon.com.mx/…"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-p`}>
            Precio aprox. (MXN)
          </label>
          <input
            id={`${id}-p`}
            name="estPriceMxn"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
            className="input"
            placeholder="350"
          />
        </div>
      </div>
      {over && (
        <p className="aviso-info">
          <span aria-hidden className="aviso-icono">
            !
          </span>
          Ojo: pasa del monto máximo del intercambio. Puedes dejarlo como idea, pero quizá no te lo regalen 😉
        </p>
      )}
      <div>
        <span className="label">
          Imagen <span className="opcional">(opcional)</span>
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-18 rounded-xl border border-linea object-cover" />
          )}
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
            {preview ? 'Cambiar imagen' : 'Subir imagen'}
          </button>
          {item?.imageUrl && (
            <label className="flex min-h-12 items-center gap-2 text-cafe">
              <input type="checkbox" className="size-6 shrink-0 accent-rosa" name="removeImage" onChange={(e) => setPreview(e.target.checked ? null : item.imageUrl)} />
              Quitar imagen
            </label>
          )}
          <input
            ref={fileRef}
            type="file"
            name="image"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : (item?.imageUrl ?? null));
            }}
          />
        </div>
      </div>
      <div className="acciones">
        <SubmitButton pendingText="Guardando…">{submitLabel}</SubmitButton>
        {onDone && item && (
          <button type="button" className="btn-ghost" onClick={onDone}>
            Cancelar
          </button>
        )}
      </div>
    </ActionForm>
  );
}
