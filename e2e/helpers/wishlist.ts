import { expect, type Locator, type Page } from '@playwright/test';
import type { Wish } from '../fixtures/people';

/** Llena el formulario "Agregar a mi lista" con foto real, nota, enlace y precio, uno por deseo. */
export async function addWishes(page: Page, wishes: Wish[]) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Agregar a mi lista' }) });
  for (const w of wishes) {
    await form.getByLabel('¿Qué te gustaría?').fill(w.title);
    await form.getByLabel('Detalles').fill(w.note);
    await form.getByLabel('Enlace').fill(w.url);
    await form.getByLabel('Precio aprox. (MXN)').fill(String(w.price));
    await form.locator('input[type=file][name=image]').setInputFiles(w.image);
    await expect(form.locator('img'), 'vista previa de la foto').toBeVisible();
    await form.getByRole('button', { name: 'Agregar a mi lista' }).click();
    await expect(page.getByRole('heading', { name: w.title, exact: true }), `tarjeta de "${w.title}"`).toBeVisible({ timeout: 20_000 });
    await expect(form.getByRole('button', { name: 'Agregar a mi lista' })).toBeEnabled();
  }
}

/** Cada tarjeta muestra título, nota, enlace correcto y una foto que de verdad cargó desde Supabase Storage. */
export async function expectWishCards(page: Page, scope: Locator, wishes: Wish[]) {
  await expect(scope.locator('article')).toHaveCount(wishes.length);
  for (const w of wishes) {
    const card = scope.locator('article').filter({ has: page.getByRole('heading', { name: w.title, exact: true }) });
    await expect(card).toContainText(w.note);
    await expect(card).toContainText(String(w.price));
    await expect(card.locator('a.chip-enlace')).toHaveAttribute('href', w.expectedHref);
    const img = card.locator('img');
    await expect(img).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/wishlist\//);
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)), {
        message: `foto de "${w.title}" cargada`,
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
  }
}

export const myListSection = (page: Page) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: 'Mi lista de deseos', exact: true }) });
