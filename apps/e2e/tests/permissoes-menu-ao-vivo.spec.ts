import { expect, test } from '@playwright/test';
import { ownerToken } from '../support/phase3';
import {
  createMemberWithRole,
  resetMemberAccessViaApi,
  setMemberAccessViaApi,
  type CreatedMember,
} from '../support/phase10';
import { readSeedState, type SeedState } from '../support/seed-state';
import { expectNoReload, loginViaUi, markNoReload } from '../support/ui';

// Celular: a barra inferior mostra "Comanda" para quem tem fin-comandas.
test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: 'serial' });

test.describe('Menu ao vivo (poll de 60 s, D-13)', () => {
  let seed: SeedState;
  let owner: string;
  let pro: CreatedMember;

  test.beforeAll(async () => {
    seed = readSeedState();
    owner = await ownerToken(seed);
    pro = await createMemberWithRole(seed, owner, 'PROFESSIONAL', 'AoVivo');
  });

  test.afterAll(async () => {
    await resetMemberAccessViaApi(owner, pro.id);
  });

  test('o item some em até ~65 s sem recarregar nem relogar', async ({ page }) => {
    test.setTimeout(120_000);
    await loginViaUi(page, pro.email, pro.password);
    const bottom = page.getByTestId('bottom-nav');
    await expect(bottom.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible();
    await expect(bottom.getByRole('link', { name: 'Comanda', exact: true })).toBeVisible();
    await markNoReload(page);

    await setMemberAccessViaApi(owner, pro.id, [{ itemId: 'fin-comandas', enabled: false }]);

    // Parada na Agenda, sem nenhuma interação: só o poll de 60 s atualiza o menu.
    await expect(bottom.getByRole('link', { name: 'Comanda', exact: true })).toHaveCount(0, {
      timeout: 65_000,
    });
    await expectNoReload(page);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(bottom.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible();
  });

  test('abrir /comanda pela URL depois do ajuste leva à tela inicial, sem login', async ({
    page,
  }) => {
    await loginViaUi(page, pro.email, pro.password);
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
    await expect(
      page.getByTestId('bottom-nav').getByRole('link', { name: 'Comanda', exact: true }),
    ).toHaveCount(0);
    await page.goto('/comanda');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/comanda/);
    await expect(page).toHaveURL(/\/agenda/);
  });
});
