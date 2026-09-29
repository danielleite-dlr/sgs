import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = 3100;
const FRONTEND_PORT = 5180;

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // O seed roda como projeto para acontecer DEPOIS de o webServer subir.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'node scripts/start-backend.mjs',
      url: `http://localhost:${BACKEND_PORT}/health`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `node node_modules/vite/bin/vite.js --port ${FRONTEND_PORT} --strictPort`,
      cwd: '../frontend',
      env: { VITE_API_URL: `http://localhost:${BACKEND_PORT}` },
      url: `http://localhost:${FRONTEND_PORT}`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
