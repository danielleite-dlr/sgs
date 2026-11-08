import { expect, test } from '@playwright/test';
import { createProfessional, ownerToken } from '../support/phase3';
import { createBridalPackage, firstWednesdayFromNow, setStudioSettings } from '../support/phase4';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

test.describe.configure({ mode: 'serial' });

/** 261108-n2o: teste da noiva incluso no pacote (metade teste, metade evento). */
test.describe('Pacote com "Inclui teste": contrato divide o serviço em teste + evento', () => {
  let seed: SeedState;
  let token: string;
  let pkg: { id: string; name: string };
  const unique = Date.now().toString(36);
  const eventDate = firstWednesdayFromNow(55);
  const brideName = `Noiva Teste Incluso ${unique}`;

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
    await createProfessional(seed, token, 'TesteIncluso');
    // um serviço só: o rateio leva o pacote inteiro (R$ 2.000,01) para ele
    pkg = await createBridalPackage(seed, token, {
      price: '2000.01',
      depositPercent: '30',
      name: `Pacote Teste Incluso ${unique}`,
    });
    await setStudioSettings(token);
  });

  test('marcar "Inclui teste" no pacote e criar o contrato: metade/metade, total igual', async ({
    page,
  }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);

    // ---- cadastro do pacote: liga "Inclui teste" no serviço ----
    await page.goto('/catalogo/pacotes');
    await page.getByRole('row', { name: new RegExp(pkg.name) }).getByRole('button', { name: 'Ações' }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Editar pacote' })).toBeVisible();
    const trial = dialog
      .getByTestId(`package-service-trial-${seed.phase3.serviceId}`)
      .getByRole('checkbox');
    await expect(trial).not.toBeChecked();
    await trial.check();
    await dialog.getByRole('button', { name: /salvar/i }).click();
    await expect(dialog).toBeHidden();

    // reabrir confirma que a marca foi gravada
    await page.getByRole('row', { name: new RegExp(pkg.name) }).getByRole('button', { name: 'Ações' }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await expect(
      page
        .getByRole('dialog')
        .getByTestId(`package-service-trial-${seed.phase3.serviceId}`)
        .getByRole('checkbox'),
    ).toBeChecked();
    await page.keyboard.press('Escape');

    // ---- contrato novo com o pacote ----
    await page.goto('/contratos');
    await page.getByTestId('new-contract').click();
    await page.getByTestId('nc-kind-noiva').check();
    await page.getByTestId('nc-bride-name').fill(brideName);
    await page.getByTestId('nc-bride-phone').fill('11987654321');
    await page.getByTestId('nc-date').fill(eventDate);
    await page.locator('#contract-package').selectOption(pkg.id);
    await page.locator('#contract-mode-a_vista').click();
    await expect(page.getByTestId('contract-form-total')).toHaveText('R$ 2.000,01');
    await page.getByTestId('contract-submit').click();

    await page.waitForURL(/\/contratos\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('contract-total')).toHaveText('R$ 2.000,01');
    const rows = page.getByTestId('contract-items-table').locator('tbody tr');
    await expect(rows).toHaveCount(2);
    // evento leva o centavo ímpar; teste incluso, pago no evento
    await expect(rows.nth(0)).toContainText(`pacote ${pkg.name}`);
    await expect(rows.nth(0)).toContainText('R$ 1.000,01');
    await expect(rows.nth(0)).not.toContainText('teste incluso');
    await expect(rows.nth(1)).toContainText('teste incluso, pago no evento');
    await expect(rows.nth(1)).toContainText('R$ 1.000,00');
  });
});
