import { expect, test } from '@playwright/test';
import { createProfessional, ownerToken } from '../support/phase3';
import { addDaysYmd, createBridalPackage, firstWednesdayFromNow, setStudioSettings } from '../support/phase4';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

test.describe.configure({ mode: 'serial' });

test.describe('Contrato que começa pela noiva: Novo contrato cria o grupo por trás', () => {
  let seed: SeedState;
  let token: string;
  let pkg: { id: string; name: string };
  const unique = Date.now().toString(36);
  const eventDate = firstWednesdayFromNow(50);
  const brideName = `Noiva Contrato ${unique}`;
  const companionName = `Madrinha Contrato ${unique}`;
  const debutanteName = `Debutante Contrato ${unique}`;
  const responsibleName = `Mae Contrato ${unique}`;
  let contractUrl = '';
  let itemsBefore = '';

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
    await createProfessional(seed, token, 'PelaNoiva');
    pkg = await createBridalPackage(seed, token, {
      price: '2000.00',
      depositPercent: '30',
      name: `Pacote Pela Noiva ${unique}`,
    });
    await setStudioSettings(token);
  });

  test('noiva: Contratos > Novo contrato cria contrato e grupo só com a noiva', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Eventos', 'Contratos');
    await page.getByTestId('new-contract').click();
    await expect(page.getByRole('heading', { name: 'Novo contrato' })).toBeVisible();
    await expect(page.getByTestId('contract-submit')).toBeDisabled();

    await page.getByTestId('nc-kind-noiva').check();
    await page.getByTestId('nc-bride-name').fill(brideName);
    await page.getByTestId('nc-bride-phone').fill('11987654321');
    await page.getByTestId('nc-date').fill(eventDate);
    await page.locator('#contract-package').selectOption(pkg.id);
    await page.locator('#contract-mode-a_vista').click();
    await expect(page.getByTestId('contract-form-total')).toHaveText('R$ 2.000,00');
    await page.getByTestId('contract-submit').click();

    await page.waitForURL(/\/contratos\/[0-9a-f-]{36}$/);
    contractUrl = page.url();
    await expect(page.getByTestId('contract-total')).toHaveText('R$ 2.000,00');
    const groupLink = page.getByRole('link', { name: `Noiva ${brideName}` });
    await expect(groupLink).toBeVisible();
    itemsBefore = await page.getByTestId('contract-items-table').innerText();

    await groupLink.click();
    await page.waitForURL(/\/noivas\/[0-9a-f-]{36}$/);
    const members = page.locator('[data-testid^="member-"]:not([data-testid="members-errors"])');
    await expect(members).toHaveCount(1);
    await expect(members.first()).toContainText(brideName);
    await expect(members.first()).toContainText('Incluída no contrato');
  });

  test('acompanhante adicionada depois entra como Paga avulso e não muda o contrato', async ({ page }) => {
    expect(contractUrl).not.toBe('');
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(contractUrl);
    await page.getByRole('link', { name: `Noiva ${brideName}` }).click();
    await page.waitForURL(/\/noivas\/[0-9a-f-]{36}$/);

    await page.getByRole('button', { name: 'Adicionar pessoa' }).click();
    await page.getByTestId('add-member-name').fill(companionName);
    await page.getByRole('dialog').getByRole('button', { name: 'Adicionar', exact: true }).click();
    const members = page.locator('[data-testid^="member-"]:not([data-testid="members-errors"])');
    await expect(members).toHaveCount(2);
    const companion = members.filter({ hasText: companionName });
    await expect(companion).toContainText('Paga avulso');

    await page.goto(contractUrl);
    await expect(page.getByTestId('contract-total')).toHaveText('R$ 2.000,00');
    expect(await page.getByTestId('contract-items-table').innerText()).toBe(itemsBefore);
    await expect(page.getByTestId('contract-items-table')).not.toContainText(companionName);
  });

  test('debutante: responsável vira a contratante do contrato', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Eventos', 'Contratos');
    await page.getByTestId('new-contract').click();
    await page.getByTestId('nc-kind-debutante').check();
    await page.getByTestId('nc-bride-name').fill(debutanteName);
    await page.getByTestId('nc-responsible-name').fill(responsibleName);
    await page.getByTestId('nc-responsible-phone').fill('11987654322');
    await page.getByTestId('nc-date').fill(addDaysYmd(eventDate, 7));
    await page.locator('#contract-package').selectOption(pkg.id);
    await page.locator('#contract-mode-a_vista').click();
    await page.getByTestId('contract-submit').click();

    await page.waitForURL(/\/contratos\/[0-9a-f-]{36}$/);
    await expect(page.locator('span', { hasText: `Contratante: ${responsibleName}` }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: `Debutante ${debutanteName}` })).toBeVisible();
  });
});
