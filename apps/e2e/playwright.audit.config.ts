import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const target = process.env.AUDIT_TARGET === 'local' ? 'local' : 'staging';
const isLocal = target === 'local';
const evidenceDir =
  process.env.AUDIT_EVIDENCE_DIR ??
  '../../.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence';

export default defineConfig({
  testDir: './audit',
  testMatch: /.*\.audit\.ts/,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    baseURL: isLocal ? 'http://localhost:5180' : 'https://sgs.jessicaseixasmakeup.com.br',
    trace: 'off',
    screenshot: 'off',
  },
  outputDir: `${evidenceDir}/test-results`,
  projects: [
    ...(isLocal
      ? [{ name: 'setup', testDir: './tests', testMatch: /.*\.setup\.ts/ }]
      : []),
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
      ...(isLocal ? { dependencies: ['setup'] } : {}),
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      ...(isLocal ? { dependencies: ['setup'] } : {}),
    },
  ],
  ...(isLocal ? { webServer: base.webServer } : {}),
});
