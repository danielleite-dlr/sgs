import { expect, test, type Locator } from '@playwright/test';
import { readSeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

const BRANCO = 'rgb(255, 255, 255)';
// Roxos de fundo que exigem letra branca (D-26): ação #570080, hover #4C0070, selecionado
// #521873 e #370053.
const ROXOS = ['rgb(87, 0, 128)', 'rgb(76, 0, 112)', 'rgb(82, 24, 115)', 'rgb(55, 0, 83)'];

async function cores(el: Locator) {
  return el.evaluate((node) => {
    const s = getComputedStyle(node);
    return { color: s.color, bg: s.backgroundColor };
  });
}

test('UX-01: "Dia" selecionado e "Salvar" têm letra branca sobre o roxo', async ({ page }) => {
  const seed = readSeedState();
  await loginViaUi(page, seed.attendant.email, seed.attendant.password);
  await navigateViaMenu(page, 'Agenda', 'Minha agenda');

  const dia = page.getByTestId('view-day');
  await expect(dia).toBeVisible();
  const c1 = await cores(dia);
  expect(c1.color).toBe(BRANCO);
  expect(ROXOS).toContain(c1.bg);

  await page.locator('[data-testid^="slot-"]').first().click();
  await expect(page.getByTestId('visit-form')).toBeVisible();
  const salvar = page.getByTestId('visit-submit');
  const c2 = await cores(salvar);
  expect(c2.color).toBe(BRANCO);
  expect(ROXOS).toContain(c2.bg);
});
