import { expect, test } from '@playwright/test';
import { ownerToken } from '../support/phase3';
import {
  createBridalPackage,
  createBrideContractViaUi,
  firstWednesdayFromNow,
  setStudioSettings,
} from '../support/phase4';
import { readSeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1200 } });

// UX-13: os dados da contratante se completam num diálogo, sem sair do contrato.
test('UX-13: Completar dados da contratante salva CPF, endereço e Celular 2 sem sair do contrato', async ({
  page,
}) => {
  const seed = readSeedState();
  const token = await ownerToken(seed);
  const unique = Date.now().toString(36);
  const pkg = await createBridalPackage(seed, token, {
    price: '2000.00',
    depositPercent: '30',
    name: `Pacote Completar ${unique}`,
  });
  await setStudioSettings(token);

  await loginViaUi(page, seed.owner.email, seed.owner.password);
  const contractId = await createBrideContractViaUi(page, {
    brideName: `Noiva Completar ${unique}`,
    packageId: pkg.id,
    eventDate: firstWednesdayFromNow(70),
  });

  const missing = page.getByTestId('contract-missing');
  await expect(missing).toContainText('CPF da contratante');
  await expect(missing).toContainText('Endereço da contratante');
  await expect(missing).toContainText('Celular 2 da contratante');
  await expect(missing.getByRole('link', { name: 'Editar cliente' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Completar dados da contratante' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Completar dados da contratante' })).toBeVisible();
  await expect(dialog.getByLabel('Celular 1')).toHaveCount(0);

  await dialog.getByLabel('CPF').fill('11111111111');
  await dialog.getByLabel('Endereço').fill('Rua das Flores, 10 - Osasco/SP');
  await dialog.getByLabel('Celular 2').fill('11911112222');
  await dialog.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(dialog.getByText(/CPF inválido/)).toBeVisible();

  await dialog.getByLabel('CPF').fill('52998224725');
  await dialog.getByRole('button', { name: 'Salvar dados' }).click();
  await expect(dialog).toHaveCount(0);

  await expect(page).toHaveURL(new RegExp(`/contratos/${contractId}$`));
  await expect(page.getByText('CPF da contratante')).toHaveCount(0);
  await expect(page.getByText('Endereço da contratante')).toHaveCount(0);
  await expect(page.getByText('Celular 2 da contratante')).toHaveCount(0);
});
