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
  await expect(page.getByTestId('forecast-card').getByText('Previsão de caixa')).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByText(ERRO)).toHaveCount(0);
  const cardGroups = page.getByTestId('forecast-card').getByTestId('forecast-cost-groups');
  for (const label of ['Custo profissional', 'Custo operacional', 'Custo fixo']) {
    await expect(cardGroups.getByText(label)).toBeVisible();
  }
  console.log(`[previsao:${project}] painel: ${(await cardGroups.innerText()).replace(/\s+/g, ' ')}`);
  await page.screenshot({ path: `${dir}/90-previsao-painel.png`, fullPage: true });

  await page.getByRole('link', { name: /Ver detalhe/ }).first().click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Previsão de caixa' }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByText(ERRO)).toHaveCount(0);
  const detailGroups = page.getByTestId('forecast-cost-groups');
  for (const label of ['Custo profissional', 'Custo operacional', 'Custo fixo']) {
    await expect(detailGroups.getByText(label)).toBeVisible();
  }
  console.log(`[previsao:${project}] detalhe: ${(await detailGroups.innerText()).replace(/\s+/g, ' ')}`);
  await page.screenshot({ path: `${dir}/90-previsao-detalhe.png`, fullPage: true });

  if (project === 'mobile') {
    // No celular o menu lateral é gaveta; abre a rota direto (recarrega e pode pedir login de novo).
    await page.goto('/financeiro/despesas-fixas');
    if (page.url().includes('/login')) {
      await loginViaUi(page, env.email, env.password);
      await page.goto('/financeiro/despesas-fixas');
    }
  } else {
    await navigateViaMenu(page, 'Financeiro', 'Despesas fixas');
  }
  await expect(page.getByRole('heading', { name: 'Despesas fixas' })).toBeVisible();
  await expect(page.getByText('Não foi possível carregar as despesas fixas.')).toHaveCount(0);
  await page.screenshot({ path: `${dir}/90-previsao-despesas-fixas.png`, fullPage: true });

  expect(blocked).toEqual([]);
});
