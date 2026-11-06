import { expect, test, type Page } from '@playwright/test';
import { loginViaUi } from '../support/ui';
import { installReadOnlyGuard, loadAuditEnv } from './audit-helpers';

const env = loadAuditEnv();
const EVID = '../../.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/mobile';

/** <li> cujo pai não é <ul>/<ol> (ex.: <li> dentro de <li>). */
async function lisForaDeLista(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Array.from(document.querySelectorAll('li')).filter(
        (li) => !['UL', 'OL'].includes(li.parentElement?.tagName ?? ''),
      ).length,
  );
}

// Somente leitura: o guard bloqueia toda mutation de negócio. Só navega e mede;
// não fecha comanda, não adiciona item e não registra pagamento. Não registra
// nomes de cliente nem de item.
test('UX-09 e UX-10 no staging (celular, somente leitura)', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'só celular');
  const blocked: string[] = [];
  await installReadOnlyGuard(page, blocked);
  await loginViaUi(page, env.email, env.password);

  // UX-10: o build de produção não emite o aviso do React; medimos o HTML.
  const rotas = ['/agenda', '/comanda', '/financeiro', '/financeiro/comissoes', '/noivas', '/contratos'];
  const ruins: Record<string, number> = {};
  for (const rota of rotas) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    ruins[rota] = await lisForaDeLista(page);
  }
  console.log(`UX-10 <li> fora de <ul>/<ol> por tela: ${JSON.stringify(ruins)}`);
  for (const n of Object.values(ruins)) expect(n).toBe(0);

  // UX-09: detalhe de uma comanda (aberta, se houver) no celular.
  await page.goto('/comanda');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const table = page.getByTestId('comanda-list');
  if (!(await table.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Mês anterior', exact: true }).click();
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }
  const rows = page.locator('[data-testid^="comanda-row-"]');
  if ((await rows.count()) === 0) {
    console.log('UX-09 sem comanda no período para abrir');
    expect(blocked).toEqual([]);
    return;
  }
  const aberta = rows.filter({ hasText: 'Aberta' }).first();
  const alvo = (await aberta.count()) > 0 ? aberta : rows.first();
  await alvo.locator('a').first().click();
  await page.waitForURL(/\/comanda\/[0-9a-f-]+$/);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  ruins['/comanda/:id'] = await lisForaDeLista(page);
  console.log(`UX-10 detalhe da comanda: ${ruins['/comanda/:id']} <li> fora de lista`);
  expect(ruins['/comanda/:id']).toBe(0);

  const top = (testId: string) =>
    page
      .getByTestId(testId)
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
      .catch(() => null);
  const yCliente = await top('comanda-cliente');
  const yItens = await top('comanda-itens');
  const yAdicionar = await top('comanda-adicionar');
  console.log(
    `UX-09 posições: cliente=${yCliente}, itens=${yItens}, adicionar=${yAdicionar ?? 'não exibido (comanda fechada ou sem permissão)'}`,
  );
  expect(yCliente).not.toBeNull();
  expect(yItens).not.toBeNull();
  expect(yItens!).toBeGreaterThan(yCliente!);
  if (yAdicionar !== null) expect(yItens!).toBeLessThan(yAdicionar);

  const nomes = page.locator('[data-testid^="comanda-item-name-"]');
  const n = await nomes.count();
  const linhas: { chars: number; linhas: number }[] = [];
  for (let i = 0; i < n; i++) {
    linhas.push(
      await nomes.nth(i).evaluate((el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
        return {
          chars: (el.textContent ?? '').trim().length,
          linhas: Math.round(el.getBoundingClientRect().height / lh),
        };
      }),
    );
  }
  console.log(`UX-09 itens: ${n}, (caracteres, linhas) = ${JSON.stringify(linhas)}`);
  for (const l of linhas) if (l.chars <= 25) expect(l.linhas).toBeLessThanOrEqual(2);

  await page.screenshot({ path: `${EVID}/05-12-comanda-detalhe.png`, fullPage: true });
  expect(blocked).toEqual([]);
});
