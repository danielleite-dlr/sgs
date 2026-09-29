// Ambiente do E2E: portas próprias, outbox de e-mail e env da raiz.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const E2E_DIR = resolve(here, '..');
export const REPO_ROOT = resolve(E2E_DIR, '..', '..');
export const BACKEND_DIR = join(REPO_ROOT, 'apps', 'backend');
export const FRONTEND_DIR = join(REPO_ROOT, 'apps', 'frontend');
export const E2E_PORTS = { backend: 3100, frontend: 5180 };
export const STATE_DIR = join(E2E_DIR, '.e2e-state');
export const OUTBOX_DIR = join(STATE_DIR, 'outbox');

/** Parse linha a linha de um .env (nunca `source`: o DATABASE_URL tem `&`). */
export function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** .env da raiz + process.env (ganha, para o CI) + overrides fixos do E2E. */
export function loadE2eEnv() {
  const fileEnv = parseEnvFile(join(REPO_ROOT, '.env'));
  return {
    ...fileEnv,
    ...process.env,
    PORT: String(E2E_PORTS.backend),
    NODE_ENV: 'test',
    FRONTEND_URL: `http://localhost:${E2E_PORTS.frontend}`,
    EMAIL_OUTBOX_DIR: OUTBOX_DIR,
    // Nenhum e-mail real sai do E2E.
    RESEND_API_KEY: '',
  };
}
