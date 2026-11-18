import { expect, test } from '@playwright/test';
import { enableCommercialForm, loginToken, randomPhone, randomSuffix } from '../support/phase9';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('Fase 9: formulário público de contato', () => {
  let seed: SeedState;
  const leadName = `Lead Site ${randomSuffix()}`;

  test.beforeAll(async () => {
    seed = readSeedState();
  });

  test('envio com consentimento cria o lead, visível ao gerente', async ({ page }) => {
    const form = await enableCommercialForm(await loginToken(seed.manager));

    // visitante sem login
    await page.goto(`/contato/${form.orgId}/${form.token}`);
    await page.locator('#pl-name').fill(leadName);
    await page.locator('#pl-phone').fill(randomPhone());
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('É preciso autorizar o contato')).toBeVisible();

    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('status')).toContainText('Recebemos seu contato');

    // o gerente vê o lead (sem responsável, pois o formulário não define um padrão)
    await loginViaUi(page, seed.manager.email, seed.manager.password);
    await navigateViaMenu(page, 'Comercial', 'Leads');
    await page.getByLabel('Sem responsável').check();
    await page.locator('#lead-search').fill(leadName);
    await expect(page.getByText(leadName).first()).toBeVisible();
  });

  test('token errado mostra Formulário indisponível', async ({ page }) => {
    const form = await enableCommercialForm(await loginToken(seed.manager));
    await page.goto(`/contato/${form.orgId}/token-errado`);
    await expect(page.getByText('Formulário indisponível')).toBeVisible();
  });
});
