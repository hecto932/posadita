import { defineConfig, devices } from '@playwright/test';
import {
  BASE_URL,
  E2E_DATABASE_URL,
  E2E_PORT,
  MAILPIT_SMTP_PORT,
  SUPABASE_SECRET_KEY,
  SUPABASE_URL,
} from './e2e/helpers/env';

/**
 * E2E de punta a punta contra el stack local (npm run e2e:up):
 * Supabase local (Postgres + Storage) y Mailpit para atrapar los correos.
 *
 * Etapas (cada una depende de la anterior): reset → organizador → participantes (20 en paralelo) → sorteo.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: Number(process.env.E2E_WORKERS ?? 4),
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    locale: 'es-MX',
    timezoneId: 'America/Hermosillo',
    video: 'on',
    trace: 'on',
    screenshot: 'on',
  },
  projects: [
    { name: 'reset', testMatch: /00-reset\.setup\.ts/ },
    { name: 'organizador', testMatch: /01-organizador\.setup\.ts/, dependencies: ['reset'] },
    { name: 'participantes', testMatch: /02-participantes\.spec\.ts/, dependencies: ['organizador'] },
    { name: 'sorteo', testMatch: /03-sorteo\.spec\.ts/, dependencies: ['participantes'] },
  ],
  webServer: {
    // Build de producción en otro puerto, para no chocar con tu `npm run dev`.
    command: `npx next build && npx next start -p ${E2E_PORT}`,
    url: BASE_URL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    // process.env le gana a .env / .env.local: así NUNCA se usan las credenciales reales de Gmail.
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      POSTGRES_URL: E2E_DATABASE_URL,
      SUPABASE_URL,
      SUPABASE_SECRET_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SECRET_KEY,
      SMTP_HOST: 'localhost',
      SMTP_PORT: MAILPIT_SMTP_PORT,
      SMTP_USER: 'e2e',
      SMTP_PASS: 'e2e',
      MAIL_FROM: 'Posadita E2E <posadita@e2e.test>',
      RESEND_API_KEY: '',
      APP_URL: BASE_URL,
      CRON_SECRET: 'e2e',
    },
  },
});
