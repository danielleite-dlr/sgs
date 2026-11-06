import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { loginViaUi, navigateViaMenu } from '../support/ui';
import { EVIDENCE_DIR, installReadOnlyGuard, loadAuditEnv } from './audit-helpers';

const env = loadAuditEnv();

test('previsão de 30 dias abre no painel e no detalhe sem erro (somente leitura)', async ({
  page,
}, info) => {
  const blocked: string[] = [];
  if (env.target === 'staging') await installReadOnlyGuard(page, blocked);
  const project = info.project.name;
  const dir = `${EVIDENCE_DIR}/${project}`;
  mkdirSync(dir, { recursive: true });
  const ERRO = 'Não foi possível carregar a previsão.';

  await loginViaUi(page, env.email, env.password);
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText('Previsão dos próximos 30 dias')).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByText(ERRO)).toHaveCount(0);
  await page.screenshot({ path: `${dir}/90-previsao-painel.png`, fullPage: true });

  await page.getByRole('link', { name: /Ver detalhe/ }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Previsão financeira — próximos 30 dias' }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByText(ERRO)).toHaveCount(0);
  await page.screenshot({ path: `${dir}/90-previsao-detalhe.png`, fullPage: true });

  await navigateViaMenu(page, 'Financeiro', 'Despesas fixas');
  await expect(page.getByRole('heading', { name: 'Despesas fixas' })).toBeVisible();
  await expect(page.getByText('Não foi possível carregar as despesas fixas.')).toHaveCount(0);
  await page.screenshot({ path: `${dir}/90-previsao-despesas-fixas.png`, fullPage: true });

  expect(blocked).toEqual([]);
});
