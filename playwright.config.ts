import { defineConfig, devices } from '@playwright/test';

// docker-compose.yml defaults APP_ORIGIN to localhost. Starting at the same host
// keeps the auth cookie when the manager redirects back from its server action.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Na CI as três apps já foram construídas por passos do workflow e são servidas por
// `next start` + gateway (scripts/e2e-server.mjs). O build deixa de estar dentro do
// prazo do webServer — um build a frio falhava ali como se fosse a suite.
// Localmente (sem CI) mantém-se o compose, que é o que se quer mesmo testar.
const hostStack = Boolean(process.env.CI) && !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: hostStack ? 'node scripts/e2e-server.mjs' : 'docker compose up --build',
        url: `${baseURL}/healthz`,
        reuseExistingServer: !process.env.CI,
        // Só arranque dos processos; os builds são passos do workflow.
        timeout: hostStack ? 120_000 : 600_000,
      },
});
