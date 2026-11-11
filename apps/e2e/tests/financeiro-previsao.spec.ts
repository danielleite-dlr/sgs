import { expect, test } from '@playwright/test';
import { readSeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

function todayDaySp(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', day: '2-digit' }).format(
      new Date(),
    ),
  );
}

/** "R$ 1.234,56" -> 1234.56 */
function parseBrl(text: string): number {
  const m = text.replace(/ /g, ' ').match(/R\$\s*([\d.]+,\d{2})/);
  if (!m) throw new Error(`Valor em reais não encontrado em: ${text}`);
  return Number(m[1].replace(/\./g, '').replace(',', '.'));
}

test('despesa fixa cadastrada entra na previsão do painel e no detalhe', async ({ page }) => {
  const seed = readSeedState();
  const name = `Aluguel E2E ${Date.now().toString(36)}`;

  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await page.waitForURL(/\/dashboard/);

  // Cadastra a despesa fixa pela UI.
  await navigateViaMenu(page, 'Financeiro', 'Despesas fixas');
  await page.getByRole('button', { name: 'Nova despesa fixa' }).first().click();
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('Valor', { exact: true }).fill('123456');
  await page.getByLabel('Dia do vencimento').fill(String(todayDaySp()));
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Despesa fixa salva.')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();

  // Aparece nas saídas do cartão do painel.
  await navigateViaMenu(page, 'Início');
  await expect(page.getByTestId('forecast-card').getByText('Previsão de caixa')).toBeVisible();
  const outflow = page.getByText('Saídas previstas').first().locator('xpath=following-sibling::p[1]');
  await expect(outflow).toBeVisible();
  // O cartão usa cache-and-network: primeiro mostra o valor em cache (sem a despesa nova) e só
  // depois o da rede. Ler uma vez só pegava às vezes o valor antigo; esperar até atualizar.
  await expect
    .poll(async () => parseBrl((await outflow.textContent()) ?? ''))
    .toBeGreaterThanOrEqual(1234.56);

  // Saídas por grupo de custo, bem visíveis no cartão.
  const groups = page.getByTestId('forecast-card').getByTestId('forecast-cost-groups');
  await expect(groups.getByText('Custo profissional')).toBeVisible();
  await expect(groups.getByText('Custo operacional')).toBeVisible();
  const fixed = groups.getByText('Custo fixo').locator('xpath=following-sibling::dd[1]');
  await expect(fixed).toBeVisible();
  expect(parseBrl((await fixed.textContent()) ?? '')).toBeGreaterThanOrEqual(1234.56);

  // Detalhe mostra a origem.
  await page.getByRole('link', { name: /Ver detalhe/ }).first().click();
  await expect(page).toHaveURL(/financeiro\/previsao/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Previsão de caixa' }),
  ).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Despesa fixa', { exact: true })).toBeVisible();
  await expect(row.getByText('R$ 1.234,56')).toBeVisible();
  await expect(row.getByText('Custo fixo', { exact: true })).toBeVisible();
  const detailGroups = page.getByTestId('forecast-cost-groups');
  await expect(detailGroups.getByText('Custo profissional')).toBeVisible();
  await expect(detailGroups.getByText('Custo operacional')).toBeVisible();
  const detailFixed = detailGroups.getByText('Custo fixo').locator('xpath=following-sibling::dd[1]');
  expect(parseBrl((await detailFixed.textContent()) ?? '')).toBeGreaterThanOrEqual(1234.56);

  // Limpeza pela UI.
  await navigateViaMenu(page, 'Financeiro', 'Despesas fixas');
  await page.getByRole('button', { name: `Excluir ${name}` }).click();
  await expect(page.getByText('Excluir despesa fixa?')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);
});
