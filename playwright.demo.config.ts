import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Demo visual: una sola ventana de Chrome recorre todo el flujo, despacio y narrado.
 * `npm run e2e:demo` (DEMO_PEOPLE, DEMO_PAUSE, DEMO_TYPE_DELAY y DEMO_SLOWMO ajustan la velocidad).
 */
const headless = process.env.DEMO_HEADLESS === '1';

// Sin el perfil de "Desktop Chrome" (viewport y escala fijos): la página toma el tamaño real de la ventana.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { viewport, deviceScaleFactor, isMobile, hasTouch, ...baseUse } = base.use ?? {};

export default defineConfig({
  ...base,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    ...baseUse,
    headless,
    // null = el contenido se ajusta a la ventana, también si la redimensionas a mano.
    viewport: headless ? { width: 1280, height: 860 } : null,
    launchOptions: {
      slowMo: Number(process.env.DEMO_SLOWMO ?? 120),
      args: ['--start-maximized'],
    },
    video: 'off',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'reset', testMatch: /00-reset\.setup\.ts/ },
    { name: 'demo', testMatch: /demo\.flujo\.ts/, dependencies: ['reset'] },
  ],
});
