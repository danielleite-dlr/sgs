import { expect, test } from '@playwright/test';
import { loginViaUi } from '../support/ui';
import { installReadOnlyGuard, loadAuditEnv } from './audit-helpers';

const env = loadAuditEnv();
const EVID = '../../.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/desktop';

// Somente leitura: o guard bloqueia toda mutation de negócio. Só navega e mede;
// não fecha comanda nem registra pagamento. Não registra nomes nem telefones.
test('UX-06, UX-07 e UX-08 no staging (computador, somente leitura)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'só computador');
  const blocked: string[] = [];
  await installReadOnlyGuard(page, blocked);
  await loginViaUi(page, env.email, env.password);
  await page.goto('/comanda');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const table = page.getByTestId('comanda-list');
  for (const preset of ['Mês anterior']) {
    if (await table.isVisible().catch(() => false)) break;
    await page.getByRole('button', { name: preset, exact: true }).click();
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }
  if (!(await table.isVisible().catch(() => false))) {
    console.log('lista vazia no mês atual e no anterior: UX-07 sem linhas para medir');
    expect(blocked).toEqual([]);
    return;
  }

  // UX-07
  const util = await page.locator('main').evaluate((el) => {
    const cs = getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  });
  const tbox = await table.boundingBox();
  console.log(`UX-07 tabela: ${Math.round(tbox!.width)}px de ${Math.round(util)}px`);
  expect(tbox!.width).toBeGreaterThanOrEqual(util * 0.8);
  const rows = page.locator('[data-testid^="comanda-row-"]');
  const n = await rows.count();
  let maxCode = 0;
  let caps = 0;
  for (let i = 0; i < n; i++) {
    const cells = rows.nth(i).locator('td');
    maxCode = Math.max(maxCode, (await cells.nth(0).boundingBox())!.height);
    const nome = (await cells.nth(1).innerText()).trim();
    if (nome.length > 3 && nome === nome.toLocaleUpperCase('pt-BR')) caps++;
  }
  console.log(`UX-07 linhas: ${n}, maior altura do código: ${Math.round(maxCode)}px, nomes todo em maiúsculas: ${caps}`);
  expect(maxCode).toBeLessThan(48);
  expect(caps).toBe(0);
  await page.screenshot({ path: `${EVID}/05-11-comanda-lista.png` });

  // UX-08 e UX-06 no detalhe da primeira comanda (aberta, se houver).
  const aberta = rows.filter({ hasText: 'Aberta' }).first();
  const alvo = (await aberta.count()) > 0 ? aberta : rows.first();
  await alvo.locator('a').first().click();
  await page.waitForURL(/\/comanda\/[0-9a-f-]+$/);
  const card = page.getByTestId('comanda-client-card');
  await expect(card).toBeVisible();
  const code = ((await page.getByRole('heading', { level: 1 }).innerText()).match(/C-\d{4}-\d+/) ?? [''])[0];
  const texto = await card.innerText();
  const repeteCodigo = code !== '' && texto.includes(code);
  const fone = await card.locator('svg.lucide-phone + span').innerText().catch(() => null);
  const foneOk = fone === null ? 'sem telefone' : /^\(\d{2}\) \d{4,5}-\d{4}$/.test(fone) ? 'formatado' : 'fora do padrão';
  console.log(`UX-08 repete código: ${repeteCodigo}, telefone: ${foneOk}`);
  expect(repeteCodigo).toBe(false);
  if (fone !== null) expect(fone).toMatch(/^\(\d{2}\) \d{4,5}-\d{4}$/);

  const fechar = page.getByTestId('comanda-close');
  if (await fechar.isVisible().catch(() => false)) {
    const enabled = await fechar.isEnabled();
    const opacity = await fechar.evaluate((el) => getComputedStyle(el).opacity);
    const motivo = await page.getByTestId('close-blocked-reason').isVisible().catch(() => false);
    console.log(`UX-06 botão: habilitado=${enabled}, opacidade=${opacity}, motivo visível=${motivo}`);
    if (enabled) expect(opacity).toBe('1');
    else expect(motivo).toBe(true);
  } else {
    console.log('UX-06 botão não exibido (comanda fechada ou sem permissão)');
  }
  await page.screenshot({ path: `${EVID}/05-11-comanda-detalhe.png` });
  expect(blocked).toEqual([]);
});
