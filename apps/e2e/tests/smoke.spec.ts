import { expect, test } from '@playwright/test';
import { readSeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

test('owner entra pela UI e cai na agenda, sem trocar senha', async ({ page }) => {
  const seed = readSeedState();
  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await expect(page).toHaveURL(/\/agenda/);
  expect(new URL(page.url()).pathname).not.toContain('trocar-senha');
});
