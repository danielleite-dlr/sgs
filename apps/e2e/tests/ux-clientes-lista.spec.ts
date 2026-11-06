import { expect, test } from '@playwright/test';
import { gql, expectNoUserErrors } from '../support/graphql';
import { ownerToken } from '../support/phase3';
import { readSeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

// UX-15: lista de clientes legível no celular (cartões, sem coluna cortada e sem rolagem lateral).
// UX-16: o nome aparece em caixa normal mesmo cadastrado todo em maiúsculas.
test('UX-15/16: no celular a lista de clientes mostra cartões com nome clicável', async ({
  browser,
}) => {
  const seed = readSeedState();
  const token = await ownerToken(seed);
  const unique = Date.now().toString(36).toUpperCase();
  const raw = `CLIENTE CELULAR ${unique}`;
  const display = `Cliente Celular ${unique.charAt(0)}${unique.slice(1).toLowerCase()}`;
  const data = await gql<{
    createClient: { client: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateClientInput!) {
      createClient(input: $input) { client { id } errors { code message } }
    }`,
    { input: { fullName: raw, phone: '(11) 98888-7777' } },
    { token },
  );
  expectNoUserErrors(data.createClient, `createClient ${raw}`);
  const client = data.createClient.client!;

  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true });
  const page = await ctx.newPage();
  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await page.goto('/clientes');
  await page.getByRole('textbox', { name: /buscar/i }).fill(unique);

  const card = page.getByTestId('cliente-card').filter({ hasText: display });
  await expect(card).toBeVisible();
  await expect(page.getByTestId('clientes-table')).toBeHidden();
  await expect(card.getByRole('button', { name: 'Ações' })).toBeVisible();
  // getByText sem exact ignora a caixa; exact compara a grafia exata.
  await expect(page.getByText(raw, { exact: true })).toHaveCount(0);

  const scroll = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(scroll.sw).toBeLessThanOrEqual(scroll.cw);

  await card.getByRole('link', { name: display }).click();
  await expect(page).toHaveURL(new RegExp(`/clientes/${client.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: display })).toBeVisible();
  await ctx.close();
});
