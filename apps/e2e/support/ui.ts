import { expect, type Page } from '@playwright/test';

export async function loginViaUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  // O formulário valida em onBlur: sem sair do campo o botão segue desabilitado.
  await page.locator('#password').blur();
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Marca a página; se ela recarregar (full page load) a marca some. */
export async function markNoReload(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __e2eNoReload?: boolean }).__e2eNoReload = true;
  });
}

export async function expectNoReload(page: Page): Promise<void> {
  const alive = await page.evaluate(
    () => (window as unknown as { __e2eNoReload?: boolean }).__e2eNoReload,
  );
  expect(alive, 'a página não deve ter sido recarregada').toBe(true);
}

/**
 * Navega pelo menu lateral (SPA, sem recarregar). `path` são os rótulos em
 * ordem: grupos primeiro, o link por último. Ex.: ['Agenda', 'Minha agenda'].
 * O menu lateral é fixo (256 px, sempre aberto no computador) e em acordeão: só o ramo da
 * rota atual nasce aberto, então o grupo é clicado quando está fechado.
 */
export async function navigateViaMenu(page: Page, ...path: string[]): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toBeVisible();

  // Um redirecionamento logo após o login (ex.: Início → Agenda para ATTENDANT) faz o
  // acordeão seguir a nova rota e recolher o grupo já aberto; por isso o caminho é refeito
  // até o clique no link passar.
  await expect(async () => {
    for (const label of path.slice(0, -1)) {
      const group = nav.getByRole('button', { name: label, exact: true });
      if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click();
    }
    const link = nav.getByRole('link', { name: path[path.length - 1], exact: true });
    await link.click({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

/** Abre o menu Ações da linha de um membro em /profissionais. */
export async function openRowActions(page: Page, name: string | RegExp): Promise<void> {
  await page.getByRole('row', { name }).getByRole('button', { name: 'Ações' }).click();
}
