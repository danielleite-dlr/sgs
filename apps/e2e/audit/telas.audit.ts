import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { test, type Page } from '@playwright/test';
import { loginViaUi } from '../support/ui';
import {
  EVIDENCE_DIR,
  collectScreenMetrics,
  installReadOnlyGuard,
  loadAuditEnv,
  saveMetrics,
} from './audit-helpers';

const env = loadAuditEnv();

test.describe.configure({ mode: 'serial' });

let consoleErrors: string[] = [];
let blocked: string[] = [];
let clicks = 0;

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  blocked = [];
  clicks = 0;
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  if (env.target === 'staging') await installReadOnlyGuard(page, blocked);
  await loginViaUi(page, env.email, env.password);
});

test.afterEach(async ({}, info) => {
  const project = info.project.name;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(
    `${EVIDENCE_DIR}/blocked-${env.target}-${project}-${info.title.slice(0, 2)}.json`,
    JSON.stringify(blocked),
  );
});

function logTask(project: string, task: string, extra: Record<string, unknown> = {}): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  appendFileSync(
    `${EVIDENCE_DIR}/tasks-${env.target}-${project}.jsonl`,
    JSON.stringify({ task, clicks, ...extra }) + '\n',
  );
}

async function click(loc: ReturnType<Page['locator']>): Promise<void> {
  await loc.click();
  clicks += 1;
}

async function go(page: Page, path: string): Promise<void> {
  await page.goto(path);
  if (page.url().includes('/login')) {
    await loginViaUi(page, env.email, env.password);
    await page.goto(path);
  }
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(600);
}

async function shoot(
  page: Page,
  project: string,
  slug: string,
  startedAt: number,
  note?: string,
): Promise<void> {
  const dir = `${EVIDENCE_DIR}/${project}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${slug}.png`, fullPage: true });
  const m = await collectScreenMetrics(page, slug, project, startedAt, consoleErrors);
  saveMetrics(m);
  if (note) logTask(project, `nota ${slug}`, { note });
}

async function firstLink(page: Page, hrefPrefix: string): Promise<string | null> {
  const hrefs = await page
    .locator(`a[href^="${hrefPrefix}/"]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  return hrefs.find((h) => !!h && !h.endsWith('/novo')) ?? null;
}

async function tolerant(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    logTask('erro', `falha de navegação: ${(e as Error).message.split('\n')[0]}`);
  }
}

// --- 1. Agenda ---
test('01-agenda-dia', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/agenda');
  await shoot(page, info.project.name, '01-agenda-dia', t);
});

test('02-agenda-semana', async ({ page }, info) => {
  await go(page, '/agenda');
  const t = Date.now();
  await tolerant(async () => {
    const week = page.getByTestId('view-week');
    if (await week.count()) await click(week);
    await page.waitForTimeout(800);
  });
  await shoot(page, info.project.name, '02-agenda-semana', t);
});

test('03-agenda-novo-agendamento', async ({ page }, info) => {
  await go(page, '/agenda');
  const t = Date.now();
  await tolerant(async () => {
    const slot = page.locator('[data-testid^="slot-"]').nth(8);
    await slot.scrollIntoViewIfNeeded();
    await click(slot);
    await page.getByTestId('visit-form').waitFor({ timeout: 5000 });
    const search = page.getByTestId('visit-client-search');
    await search.fill('ana');
    await page.waitForTimeout(800);
  });
  await shoot(page, info.project.name, '03-agenda-novo-agendamento', t);
  logTask(info.project.name, 'marcar horário (até antes de salvar)', { ms: Date.now() - t });
});

test('04-agenda-detalhe', async ({ page }, info) => {
  await go(page, '/agenda');
  const t = Date.now();
  let note = 'sem agendamentos — estado vazio';
  await tolerant(async () => {
    const card = page.locator('[data-testid^="appointment-card-"]').first();
    if (await card.count()) {
      await card.scrollIntoViewIfNeeded();
      await card.click();
      await page.getByTestId('appointment-details').waitFor({ timeout: 5000 });
      note = 'detalhe aberto';
    }
  });
  await shoot(page, info.project.name, '04-agenda-detalhe', t, note);
});

// --- 2. Comanda e caixa ---
test('05-comanda-lista', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/comanda');
  await shoot(page, info.project.name, '05-comanda-lista', t);
});

test('06-comanda-detalhe', async ({ page }, info) => {
  await go(page, '/comanda');
  const t = Date.now();
  let note = 'sem comandas';
  await tolerant(async () => {
    const href = await firstLink(page, '/comanda');
    if (href) {
      await go(page, href);
      note = 'detalhe aberto';
    }
  });
  await shoot(page, info.project.name, '06-comanda-detalhe', t, note);
});

test('07-financeiro', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/financeiro');
  await shoot(page, info.project.name, '07-financeiro', t);
});

test('08-financeiro-comissoes', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/financeiro/comissoes');
  await shoot(page, info.project.name, '08-financeiro-comissoes', t);
});

// --- 3. Noivas e contratos ---
test('09-noivas-lista', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/noivas');
  await shoot(page, info.project.name, '09-noivas-lista', t);
});

test('10-noivas-detalhe', async ({ page }, info) => {
  await go(page, '/noivas');
  const t = Date.now();
  let note = 'sem grupos';
  await tolerant(async () => {
    const href = await firstLink(page, '/noivas');
    if (href) {
      await go(page, href);
      note = 'detalhe aberto';
    }
  });
  await shoot(page, info.project.name, '10-noivas-detalhe', t, note);
});

test('11-contratos-lista', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/contratos');
  await shoot(page, info.project.name, '11-contratos-lista', t);
});

test('12-contrato-detalhe', async ({ page }, info) => {
  await go(page, '/contratos');
  const t = Date.now();
  let note = 'sem contratos';
  await tolerant(async () => {
    const href = await firstLink(page, '/contratos');
    if (href) {
      await go(page, href);
      note = 'detalhe aberto';
      const pay = page.getByRole('button', { name: /pagamento|parcela|receber/i }).first();
      if (await pay.count()) {
        await click(pay);
        await page.waitForTimeout(600);
        note += '; diálogo de pagamento aberto (parado antes de confirmar)';
      }
    }
  });
  await shoot(page, info.project.name, '12-contrato-detalhe', t, note);
  logTask(info.project.name, 'registrar parcela (até antes de confirmar)', { note });
});

// --- 4. Clientes e financeiro ---
test('13-clientes-lista', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/clientes');
  await shoot(page, info.project.name, '13-clientes-lista', t);
});

test('14-clientes-busca', async ({ page }, info) => {
  await go(page, '/clientes');
  const t = Date.now();
  let searchMs = -1;
  await tolerant(async () => {
    const input = page.getByRole('searchbox').or(page.getByPlaceholder(/buscar|pesquis/i)).first();
    const s = Date.now();
    await input.fill('mar');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    searchMs = Date.now() - s;
    const href = await firstLink(page, '/clientes');
    if (href) {
      // Lista e cartões do celular têm o mesmo link; só um deles está visível.
      const link = page.locator(`a[href="${href}"]:visible`).first();
      await click(link);
      await page.waitForURL(/\/clientes\/[0-9a-f-]+/);
    }
  });
  await shoot(page, info.project.name, '14-clientes-busca', t);
  logTask(info.project.name, 'achar cliente (buscar e abrir ficha)', { searchMs });
});

test('15-cliente-detalhe', async ({ page }, info) => {
  await go(page, '/clientes');
  const t = Date.now();
  await tolerant(async () => {
    const href = await firstLink(page, '/clientes');
    if (href) await go(page, href);
  });
  await shoot(page, info.project.name, '15-cliente-detalhe', t);
});

// --- 5. Painel ---
test('16-painel', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/dashboard');
  await shoot(page, info.project.name, '16-painel', t, `destino final: ${new URL(page.url()).pathname}`);
});

// --- 6. Previsão de caixa (06-07) ---
test('17-financeiro-previsao', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/financeiro/previsao');
  await shoot(page, info.project.name, '17-financeiro-previsao', t);
});

// --- 7. Despesas fixas (06-08) ---
test('18-financeiro-despesas-fixas', async ({ page }, info) => {
  const t = Date.now();
  await go(page, '/financeiro/despesas-fixas');
  await shoot(page, info.project.name, '18-financeiro-despesas-fixas', t);
});
