import { expect, test } from '@playwright/test';
import { ownerToken } from '../support/phase3';
import {
  createMemberWithRole,
  resetMemberAccessViaApi,
  setMemberAccessViaApi,
  type CreatedMember,
} from '../support/phase10';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('Área ganha por ajuste', () => {
  let seed: SeedState;
  let owner: string;
  let atendente: CreatedMember;

  test.beforeAll(async () => {
    seed = readSeedState();
    owner = await ownerToken(seed);
    atendente = await createMemberWithRole(seed, owner, 'ATTENDANT', 'Ganha');
    await setMemberAccessViaApi(owner, atendente.id, [{ itemId: 'fin-controle', enabled: true }]);
  });

  test.afterAll(async () => {
    await resetMemberAccessViaApi(owner, atendente.id);
  });

  test('Atendente com Controle financeiro vê o item e abre o caixa', async ({ page }) => {
    await loginViaUi(page, atendente.email, atendente.password);
    await navigateViaMenu(page, 'Financeiro', 'Controle de entrada e saída');
    await expect(page).toHaveURL(/\/financeiro$/);
    await expect(page.getByTestId('kpi-billed')).toBeVisible();
    await expect(page.getByTestId('kpi-received')).toBeVisible();
    await expect(page.getByText(/acesso negado|sem permissão/i)).toHaveCount(0);
  });
});
