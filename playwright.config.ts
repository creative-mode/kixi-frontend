import { defineConfig, devices } from '@playwright/test';

// docker-compose.yml defaults APP_ORIGIN to localhost. Starting at the same host
// keeps the auth cookie when the manager redirects back from its server action.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

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
        command: 'docker compose up --build',
        url: `${baseURL}/healthz`,
        reuseExistingServer: !process.env.CI,
        timeout: 600_000,
      },
});
