import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // 120s (brief said 60s): Next dev compiles routes on demand — on a cold
  // server the login → '/' → '/fr' chain alone can exceed 60s on Windows.
  timeout: 120_000,
  retries: 0,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'fr-FR'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/fr',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
