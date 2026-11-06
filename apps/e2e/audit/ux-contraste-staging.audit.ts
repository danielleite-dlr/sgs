import { expect, test, type Page } from '@playwright/test';
import { loginViaUi } from '../support/ui';
import { installReadOnlyGuard, loadAuditEnv } from './audit-helpers';

const env = loadAuditEnv();
const ROXOS = ['rgb(87, 0, 128)', 'rgb(68, 0, 100)', 'rgb(55, 0, 83)'];

/** Todo elemento clicável com fundo roxo da marca deve ter letra branca. */
async function roxosSemTextoBranco(page: Page): Promise<{ total: number; ruins: string[] }> {
  return page.evaluate((roxos) => {
    const ruins: string[] = [];
    let total = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="tab"]'))) {
      const s = getComputedStyle(el);
      if (!roxos.includes(s.backgroundColor)) continue;
      total += 1;
      if (s.color !== 'rgb(255, 255, 255)') {
        ruins.push(`${(el.textContent ?? '').trim().slice(0, 30)} -> ${s.color}`);
      }
    }
    return { total, ruins };
  }, ROXOS);
}

// Somente leitura: nenhum POST/PUT/DELETE é permitido pelo guard.
test('UX-01 no staging: letra branca sobre roxo (somente leitura)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'só desktop');
  const blocked: string[] = [];
  await installReadOnlyGuard(page, blocked);
  await loginViaUi(page, env.email, env.password);

  for (const rota of ['/agenda', '/financeiro', '/financeiro/previsao', '/comandas']) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const r = await roxosSemTextoBranco(page);
    console.log(`${rota}: ${r.total} elementos roxos, ruins=${JSON.stringify(r.ruins)}`);
    expect(r.ruins, rota).toEqual([]);
    if (rota === '/agenda') {
      await expect(page.getByTestId('view-day')).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(page.getByText('Pgto')).toHaveCount(0);
    }
  }

  await page.goto('/agenda');
  await page.locator('[data-testid^="slot-"]').first().click();
  await expect(page.getByTestId('visit-form')).toBeVisible();
  await expect(page.getByTestId('visit-submit')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.getByRole('button', { name: /fechar|close/i })).toHaveCount(1);
  expect(blocked).toEqual([]);
});
