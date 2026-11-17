import { expect, type Locator, type Page } from '@playwright/test';
import type { Wish } from '../fixtures/people';

/** Velocidad de la demo (ms). Se ajusta con variables de entorno; en 0 corre a velocidad de prueba normal. */
export const PAUSE = Number(process.env.DEMO_PAUSE ?? 1200);
export const TYPE_DELAY = Number(process.env.DEMO_TYPE_DELAY ?? 25);

export const pause = (page: Page, factor = 1) => (PAUSE ? page.waitForTimeout(PAUSE * factor) : Promise.resolve());

/**
 * Cartel fijo abajo de la pantalla que narra lo que está pasando.
 * Se vuelve a pintar solo después de cada navegación de la pestaña.
 */
export class Narrator {
  private title = '';
  private detail = '';

  constructor(
    private page: Page,
    private tab: string,
  ) {
    page.on('load', () => void this.render().catch(() => {}));
  }

  async say(title: string, detail = '') {
    this.title = title;
    this.detail = detail;
    await this.render();
  }

  private render() {
    return this.page.evaluate(
      ([tab, title, detail]) => {
        let el = document.getElementById('__e2e_narrador');
        if (!el) {
          el = document.createElement('div');
          el.id = '__e2e_narrador';
          Object.assign(el.style, {
            position: 'fixed',
            left: '50%',
            bottom: '18px',
            transform: 'translateX(-50%)',
            zIndex: '2147483647',
            background: 'rgba(28, 16, 10, 0.92)',
            color: '#fff',
            padding: '12px 22px',
            borderRadius: '16px',
            font: '600 17px/1.4 system-ui, sans-serif',
            maxWidth: 'min(92vw, 900px)',
            boxShadow: '0 10px 30px rgba(0,0,0,.35)',
            pointerEvents: 'none',
            textAlign: 'center',
          });
          document.documentElement.appendChild(el);
        }
        el.replaceChildren();
        const tag = document.createElement('div');
        tag.textContent = `🧪 E2E · ${tab}`;
        Object.assign(tag.style, { font: '700 12px/1 system-ui', letterSpacing: '.08em', color: '#ffb3dc', marginBottom: '6px' });
        const t = document.createElement('div');
        t.textContent = title;
        el.append(tag, t);
        if (detail) {
          const d = document.createElement('div');
          d.textContent = detail;
          Object.assign(d.style, { font: '400 14px/1.4 system-ui', opacity: '.85', marginTop: '4px' });
          el.append(d);
        }
      },
      [this.tab, this.title, this.detail] as const,
    );
  }
}

/** Lleva el elemento al centro de la pantalla y lo enmarca en rosa unos segundos. */
export async function spot(target: Locator, factor = 1) {
  await target.scrollIntoViewIfNeeded();
  await target.evaluate((el: HTMLElement) => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const prev = el.style.cssText;
    el.style.outline = '4px solid #e4007c';
    el.style.outlineOffset = '4px';
    el.style.borderRadius ||= '12px';
    el.style.transition = 'outline-color .3s';
    setTimeout(() => (el.style.cssText = prev), 2500);
  });
  await pause(target.page(), factor);
}

/** Escribe tecla por tecla para que se vea cómo se llena el campo. */
export async function type(field: Locator, text: string) {
  await field.click();
  await field.clear();
  if (TYPE_DELAY) await field.pressSequentially(text, { delay: TYPE_DELAY });
  else await field.fill(text);
}

/** Igual que addWishes de las pruebas, pero escribiendo a la vista y resaltando cada tarjeta nueva. */
export async function addWishesSlowly(page: Page, wishes: Wish[], narrator: Narrator, who: string) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Agregar a mi lista' }) });
  for (const [i, w] of wishes.entries()) {
    await narrator.say(`${who} agrega su deseo ${i + 1} de ${wishes.length}`, `“${w.title}” · foto real · enlace · $${w.price}`);
    await type(form.getByLabel('¿Qué te gustaría?'), w.title);
    await type(form.getByLabel('Detalles'), w.note);
    await type(form.getByLabel('Enlace'), w.url);
    await type(form.getByLabel('Precio aprox. (MXN)'), String(w.price));
    await form.locator('input[type=file][name=image]').setInputFiles(w.image);
    await expect(form.locator('img')).toBeVisible();
    await spot(form.locator('img'), 0.5);
    await form.getByRole('button', { name: 'Agregar a mi lista' }).click();
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: w.title, exact: true }) });
    await expect(card, `tarjeta de "${w.title}"`).toBeVisible({ timeout: 20_000 });
    await expect(form.getByRole('button', { name: 'Agregar a mi lista' })).toBeEnabled();
    await spot(card, 0.6);
  }
}
