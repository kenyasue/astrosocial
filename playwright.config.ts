import { defineConfig, devices } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_PATH, E2E_PORT, E2E_UPLOADS_DIR } from './e2e/config';

/**
 * Playwright configuration.
 *
 * The web server is launched in TEST MODE (OPENMEOW_TEST_MODE=1), which forces
 * the login PIN to "000000" so tests can authenticate deterministically, and
 * points at an isolated database under e2e/.tmp (reset in global-setup).
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // `list` for console output plus an HTML report (with embedded screenshots,
  // traces, and video) you can open via `npm run test:e2e:report`.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_BASE_URL,
    // Capture a screenshot at the end of every test and keep traces/video so
    // failures (and successes) can be inspected visually.
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      OPENMEOW_TEST_MODE: '1',
      OPENMEOW_DB_PATH: E2E_DB_PATH,
      OPENMEOW_UPLOADS_DIR: E2E_UPLOADS_DIR,
      PORT: String(E2E_PORT),
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'e2e-admin-pass',
    },
  },
});
