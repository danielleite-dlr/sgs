import { expect, test } from '@playwright/test';
import { readSeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

test('owner entra pela UI e cai no painel, sem trocar senha', async ({ page }) => {
  const seed = readSeedState();
  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
  expect(new URL(page.url()).pathname).not.toContain('trocar-senha');
});

test('atendente entra e cai na agenda (D-11)', async ({ page }) => {
  const seed = readSeedState();
  await loginViaUi(page, seed.attendant.email, seed.attendant.password);
  await expect(page).toHaveURL(/\/agenda/);
});
