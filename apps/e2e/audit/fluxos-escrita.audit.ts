import { appendFileSync, mkdirSync } from 'node:fs';
import { test, type Locator, type Page } from '@playwright/test';
import { dragCardBySlots, openAgendaAt, slotHeightOf } from '../support/agenda-ui';
import {
  createClient,
  createProfessional,
  createVisit,
  daysUntilNextWednesday,
  ownerToken,
  spDate,
  spInstant,
} from '../support/phase3';
import { createBridalPackage, firstWednesdayFromNow } from '../support/phase4';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';
import { EVIDENCE_DIR, loadAuditEnv } from './audit-helpers';

test.describe('Fluxos com escrita (somente local semeado, D-12)', () => {
  test.skip(
    loadAuditEnv().target !== 'local',
    'fluxos com escrita só no ambiente local semeado (D-12)',
  );
  test.describe.configure({ mode: 'serial' });

  let seed: SeedState;
  let token: string;
  let clicks = 0;
  let started = 0;
  const ahead = daysUntilNextWednesday();

  const begin = (): void => {
    clicks = 0;
    started = Date.now();
  };
  const c = async (loc: Locator): Promise<void> => {
    await loc.click();
    clicks += 1;
  };
  const finish = (project: string, task: string, notes: string): void => {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    appendFileSync(
      `${EVIDENCE_DIR}/tasks-local-${project}.jsonl`,
      JSON.stringify({ task, clicks, ms: Date.now() - started, notes }) + '\n',
    );
  };
  const shot = async (page: Page, project: string, name: string): Promise<void> => {
    mkdirSync(`${EVIDENCE_DIR}/${project}`, { recursive: true });
    await page.screenshot({ path: `${EVIDENCE_DIR}/${project}/w-${name}.png`, fullPage: true });
  };
  const attempt = async (
    page: Page,
    project: string,
    task: string,
    fn: () => Promise<string>,
  ): Promise<void> => {
    begin();
    let notes = '';
    try {
      notes = await fn();
    } catch (e) {
      notes = `interrompido: ${(e as Error).message.split('\n')[0].slice(0, 160)}`;
    }
    await shot(page, project, task.slice(0, 20).replace(/\W+/g, '-')).catch(() => undefined);
    finish(project, task, notes);
  };

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
  });

  test('a) marcar horário até salvar', async ({ page }, info) => {
    const project = info.project.name;
    const pro = await createProfessional(seed, token, `Aud${project}`);
    const client = await createClient(token, `Aud${project}`);
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await openAgendaAt(page, ahead).catch(() => page.goto('/agenda'));
    await attempt(page, project, 'marcar horário (até salvar)', async () => {
      const slot = page.getByTestId(`slot-${pro.id}-09:00`);
      await slot.scrollIntoViewIfNeeded();
      await c(slot);
      await page.getByTestId('visit-client-search').fill(client.name);
      await c(page.getByTestId(`visit-client-option-${client.id}`));
      await page.getByTestId('visit-line-0-service').selectOption(seed.phase3.serviceId);
      await page.getByTestId('visit-line-0-professional').selectOption(pro.id);
      await c(page.getByTestId('visit-submit'));
      await page.getByText(/Comanda C-\d{4}-\d+ aberta/).waitFor({ timeout: 8000 });
      return 'agendamento salvo; seleção de serviço/profissional por select nativo (contados como 0 cliques de abertura)';
    });
  });

  test('b) remarcar (arrastar)', async ({ page }, info) => {
    const project = info.project.name;
    const pro = await createProfessional(seed, token, `Dnd${project}`);
    const day = spDate(ahead);
    const visit = await createVisit(token, {
      clientId: seed.phase3.clientId,
      serviceId: seed.phase3.serviceId,
      professionalId: pro.id,
      startsAt: spInstant(day, '10:00'),
      endsAt: spInstant(day, '11:00'),
    });
    const id = visit.appointments[0].id;
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await openAgendaAt(page, ahead);
    await attempt(page, project, 'remarcar (arrastar)', async () => {
      const card = page.getByTestId(`appointment-card-${id}`);
      const h = await slotHeightOf(page, pro.id);
      await dragCardBySlots(page, card, h, 2);
      clicks += 1; // um gesto de arrastar
      await page.getByText('Agendamento movido.').waitFor({ timeout: 8000 });
      return 'um gesto de arrastar; em tela de toque o arrastar depende de pressionar e segurar';
    });
  });

  test('c) fechar comanda e receber', async ({ page }, info) => {
    const project = info.project.name;
    const pro = await createProfessional(seed, token, `Cmd${project}`);
    const day = spDate(ahead);
    const visit = await createVisit(token, {
      clientId: seed.phase3.clientId,
      serviceId: seed.phase3.serviceId,
      professionalId: pro.id,
      startsAt: spInstant(day, '15:00'),
      endsAt: spInstant(day, '16:00'),
    });
    const id = visit.appointments[0].id;
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await openAgendaAt(page, ahead);
    await attempt(page, project, 'fechar comanda e receber (dinheiro + Pix)', async () => {
      const card = page.getByTestId(`appointment-card-${id}`);
      await card.scrollIntoViewIfNeeded();
      await c(card);
      await c(page.getByTestId('appointment-open-comanda'));
      await page.waitForURL(/\/comanda\/[0-9a-f-]+$/);
      const total = Number(seed.phase3.servicePrice);
      await c(page.getByTestId('comanda-add-product'));
      await page.getByTestId('add-item-product').selectOption(seed.phase3.productId);
      await page.getByTestId('add-item-professional').selectOption(pro.id);
      await c(page.getByTestId('add-item-submit'));
      await page.getByTestId('payment-method-select').selectOption('pix');
      await page.getByTestId('payment-amount').fill('1500');
      await c(page.getByTestId('payment-add'));
      await page.waitForTimeout(800);
      await page.getByTestId('payment-method-select').selectOption('cash');
      await page.getByTestId('payment-amount').fill(String(Math.round((total + 35) * 100)));
      await c(page.getByTestId('payment-add'));
      await page.waitForTimeout(800);
      await c(page.getByTestId('comanda-close'));
      await page.getByTestId('comanda-status').waitFor({ timeout: 8000 });
      return 'comanda aberta pelo card da agenda, item adicionado, Pix + dinheiro, fechada';
    });
  });

  test('d) criar contrato e registrar parcela', async ({ page }, info) => {
    const project = info.project.name;
    await createProfessional(seed, token, `Nov${project}`);
    const pkg = await createBridalPackage(seed, token, { price: '3000.00', depositPercent: '30' });
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto('/noivas');
    await attempt(page, project, 'criar grupo e contrato, registrar parcela', async () => {
      await c(page.getByTestId('new-group'));
      await page.getByTestId('bg-name').fill(`Auditoria ${project}`);
      await page.getByTestId('bg-date').fill(firstWednesdayFromNow(40));
      await page.getByTestId('bg-ready').fill('15:00');
      await page.getByTestId('group-event-time').fill('16:00');
      await page.getByTestId('bride-name').fill(`Noiva Auditoria ${project}`);
      await page.getByTestId('bride-add-service').selectOption(seed.phase3.serviceId);
      await c(page.getByTestId('bg-submit'));
      await page.waitForURL(/\/noivas\/[0-9a-f-]{36}$/);
      await c(page.getByTestId('create-contract'));
      await page.locator('#contract-package').selectOption(pkg.id);
      await page.locator('#contract-days').fill('10');
      await c(page.getByTestId('contract-submit'));
      await page.waitForURL(/\/contratos\/[0-9a-f-]{36}$/);
      await c(page.getByRole('button', { name: /registrar pagamento/i }).first());
      await page.waitForTimeout(600);
      await c(page.getByRole('button', { name: /^registrar pagamento$/i }).last());
      await page.waitForTimeout(1200);
      return 'grupo criado, contrato criado e primeira parcela registrada (a ficha da cliente pode exigir dados extras antes de aceitar)';
    });
  });

  test('e) achar cliente e abrir a ficha', async ({ page }, info) => {
    const project = info.project.name;
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto('/clientes');
    await attempt(page, project, 'achar cliente e abrir a ficha', async () => {
      const input = page.getByPlaceholder(/buscar cliente/i);
      await input.fill('Aud');
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const link = page.locator('a[href^="/clientes/"]').first();
      if (await link.count()) {
        await c(link);
        await page.waitForURL(/\/clientes\/[0-9a-f-]+/, { timeout: 4000 });
        return 'ficha aberta pelo link do nome';
      }
      const row = page.getByRole('row').nth(1);
      await c(row);
      await page.waitForTimeout(800);
      return `nome não é link; clique na linha leva a ${new URL(page.url()).pathname}`;
    });
  });
});
