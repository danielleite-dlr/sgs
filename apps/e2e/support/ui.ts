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
