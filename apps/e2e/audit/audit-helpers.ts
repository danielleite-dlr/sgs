import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { readSeedState } from '../support/seed-state';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
/** Checkout principal, onde mora a credencial mesmo quando rodamos num worktree. */
const MAIN_CHECKOUT = '/root/sgs';

export interface AuditEnv {
  baseUrl: string;
  email: string;
  password: string;
  target: 'staging' | 'local';
}

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

export function loadAuditEnv(): AuditEnv {
  const target = process.env.AUDIT_TARGET === 'local' ? 'local' : 'staging';
  if (target === 'local') {
    const owner = readSeedState().owner;
    return {
      baseUrl: 'http://localhost:5180',
      email: owner.email,
      password: owner.password,
      target,
    };
  }
  const candidates = [resolve(REPO_ROOT, '.env.audit'), resolve(MAIN_CHECKOUT, '.env.audit')];
  const file = candidates.find((p) => existsSync(p));
  if (!file) {
    throw new Error(
      'Credencial de auditoria ausente: crie /root/sgs/.env.audit (plano 05-01, Task 1)',
    );
  }
  const env = parseEnvFile(file);
  if (!env.AUDIT_EMAIL || !env.AUDIT_PASSWORD) {
    throw new Error(
      'Credencial de auditoria ausente: crie /root/sgs/.env.audit (plano 05-01, Task 1)',
    );
  }
  return {
    baseUrl: env.AUDIT_BASE_URL ?? 'https://sgs.jessicaseixasmakeup.com.br',
    email: env.AUDIT_EMAIL,
    password: env.AUDIT_PASSWORD,
    target,
  };
}

export const ALLOWED_MUTATIONS = new Set(['Login', 'RefreshSession', 'Logout']);

/** Bloqueia no navegador toda mutation de negócio e registra o operationName. */
export async function installReadOnlyGuard(page: Page, blocked: string[]): Promise<void> {
  await page.route('**/graphql', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      type Body = { query?: string; operationName?: string };
      let body: Body | null = null;
      try {
        body = request.postDataJSON() as Body;
      } catch {
        body = null;
      }
      const query = body?.query ?? '';
      const op = body?.operationName ?? '(sem nome)';
      if (/^\s*mutation\b/.test(query) && !ALLOWED_MUTATIONS.has(op)) {
        blocked.push(op);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: 'Bloqueado pela auditoria (somente leitura)' }],
          }),
        });
        return;
      }
    }
    await route.continue();
  });
}

export const UNACCENTED_WORDS = [
  'nao', 'voce', 'servico', 'servicos', 'comissao', 'comissoes', 'configuracoes',
  'configuracao', 'informacoes', 'descricao', 'situacao', 'pagina', 'proximo', 'opcao',
  'acoes', 'numero', 'codigo', 'periodo', 'preco', 'obrigatorio', 'invalido', 'sera',
  'historico', 'observacoes', 'endereco', 'horario', 'horarios', 'sessao', 'ultimo',
  'proxima',
];

export interface ScreenMetrics {
  screen: string;
  project: string;
  url: string;
  horizontalOverflow: boolean;
  smallTargets: { text: string; w: number; h: number }[];
  unaccented: string[];
  englishWords: string[];
  consoleErrors: string[];
  loadMs: number;
}

export async function collectScreenMetrics(
  page: Page,
  screen: string,
  project: string,
  startedAt: number,
  consoleErrors: string[],
): Promise<ScreenMetrics> {
  const loadMs = Date.now() - startedAt;
  const data = await page.evaluate(
    ({ words, checkTargets }) => {
      const horizontalOverflow =
        document.documentElement.scrollWidth > window.innerWidth;
      const smallTargets: { text: string; w: number; h: number }[] = [];
      if (checkTargets) {
        const els = document.querySelectorAll<HTMLElement>(
          'button, a, [role=button], input, select',
        );
        for (const el of Array.from(els)) {
          if (smallTargets.length >= 20) break;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.width < 44 || r.height < 44) {
            const label =
              (el.getAttribute('aria-label') || el.innerText || el.tagName)
                .trim()
                .slice(0, 40);
            smallTargets.push({ text: label, w: Math.round(r.width), h: Math.round(r.height) });
          }
        }
      }
      const text = document.body.innerText;
      const unaccented = words.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
      const eng = text.match(
        /\b(Loading|Error|Submit|Cancel|Save|Delete|Search|Next|Previous|No data|Required)\b/g,
      );
      return {
        horizontalOverflow,
        smallTargets,
        unaccented,
        englishWords: Array.from(new Set(eng ?? [])),
      };
    },
    { words: UNACCENTED_WORDS, checkTargets: project === 'mobile' },
  );
  return {
    screen,
    project,
    url: page.url().replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'),
    consoleErrors,
    loadMs,
    ...data,
  };
}

export const EVIDENCE_DIR =
  process.env.AUDIT_EVIDENCE_DIR ??
  resolve(REPO_ROOT, '.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence');

export function saveMetrics(m: ScreenMetrics): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  appendFileSync(`${EVIDENCE_DIR}/metrics-${m.project}.jsonl`, JSON.stringify(m) + '\n');
}
