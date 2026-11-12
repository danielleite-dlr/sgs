import { expect, test } from '@playwright/test';
import { createProfessional, ownerToken } from '../support/phase3';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

// quick 261112-cko: a grade da agenda rola nas duas direções com o cabeçalho fixo, e o menu
// principal recolhe para uma faixa de ícones (lembrada depois de recarregar).
test.use({ viewport: { width: 1280, height: 720 } });

test.describe('Agenda: rolagem e menu recolhido', () => {
  let seed: SeedState;

  test.beforeAll(async () => {
    seed = readSeedState();
    const token = await ownerToken(seed);
    // Garante colunas suficientes para passar da largura com a densidade G (220 px).
    for (const n of ['RolA', 'RolB', 'RolC', 'RolD', 'RolE']) {
      await createProfessional(seed, token, n);
    }
  });

  test('grade rola na vertical e na horizontal, com cabeçalho e horas fixos', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Agenda');
    const scroll = page.getByTestId('schedule-scroll');
    await expect(page.getByTestId('day-grid')).toBeVisible();

    await page.locator('#col-G').click(); // Coluna: G
    const m = await scroll.evaluate((el) => ({
      vertical: el.scrollHeight > el.clientHeight,
      horizontal: el.scrollWidth > el.clientWidth,
      overflow: getComputedStyle(el).overflow,
    }));
    // A espessura da barra não dá para medir aqui: o Chromium headless roda com --hide-scrollbars.
    expect(m.overflow).toBe('auto');
    expect(m.vertical).toBe(true);
    expect(m.horizontal).toBe(true);

    const topo = (await scroll.boundingBox())!.y;
    const cabecalho = page.getByTestId(/^lane-avatar-/).first();
    await scroll.evaluate((el) => el.scrollTo({ top: 600, left: 400 }));
    await expect
      .poll(async () => (await cabecalho.boundingBox())!.y - topo)
      .toBeLessThan(80);
    const horas = page.getByTestId('time-row').first().locator('xpath=..');
    const esquerda = (await scroll.boundingBox())!.x;
    expect((await horas.boundingBox())!.x - esquerda).toBeLessThan(24);
  });

  test('menu principal recolhe para ícones e continua recolhido ao recarregar', async ({
    page,
  }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.getByRole('button', { name: 'Recolher menu' }).click();
    const faixa = page.getByTestId('sidebar-collapsed');
    await expect(faixa).toBeVisible();
    expect((await faixa.boundingBox())!.width).toBe(64);

    await page.reload();
    await expect(page.getByTestId('sidebar-collapsed')).toBeVisible();
    await page.getByTestId('sidebar-collapsed').getByRole('link', { name: 'Agenda' }).click();
    await expect(page.getByTestId('view-day')).toBeVisible();

    await page.getByRole('button', { name: 'Expandir menu' }).click();
    await expect(page.getByRole('button', { name: 'Recolher menu' })).toBeVisible();
  });
});
