import { expect, test } from '@playwright/test';
import { gql, expectNoUserErrors } from '../support/graphql';
import { ownerToken } from '../support/phase3';
import { readSeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

// Comanda e caixa (lote 1): UX-07, lista de comandas em largura total.
test.use({ viewport: { width: 1366, height: 768 } });

test('UX-07: lista de comandas usa a largura da tela e o código cabe em uma linha', async ({
  page,
}) => {
  const seed = readSeedState();
  const token = await ownerToken(seed);
  const suffix = Date.now().toString(36).toUpperCase();
  const fullName = `E2E CLIENTE LISTA ${suffix}`;

  const created = await gql<{
    createClient: { client: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateClientInput!) {
      createClient(input: $input) { client { id } errors { code message } }
    }`,
    { input: { fullName, phone: '(11) 98888-7777' } },
    { token },
  );
  expectNoUserErrors(created.createClient, 'createClient');
  const opened = await gql<{
    openWalkInComanda: { comanda: { id: string; code: string } | null; errors: never[] };
  }>(
    `mutation($input: OpenWalkInComandaInput!) {
      openWalkInComanda(input: $input) { comanda { id code } errors { code message } }
    }`,
    { input: { clientId: created.createClient.client!.id } },
    { token },
  );
  expectNoUserErrors(opened.openWalkInComanda, 'openWalkInComanda');
  const comanda = opened.openWalkInComanda.comanda!;

  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await page.goto('/comanda');

  const table = page.getByTestId('comanda-list');
  await expect(table).toBeVisible();
  const row = page.getByTestId(`comanda-row-${comanda.id}`);
  await expect(row).toBeVisible();

  // Tabela ocupa pelo menos 80% da largura útil do conteúdo principal.
  const main = page.locator('main');
  const util = await main.evaluate((el) => {
    const cs = getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  });
  const tbox = await table.boundingBox();
  expect(tbox!.width, `tabela ${tbox!.width}px de ${util}px`).toBeGreaterThanOrEqual(util * 0.8);

  // Código em uma linha só.
  const codeCell = row.locator('td').first();
  await expect(codeCell).toHaveText(comanda.code);
  const cbox = await codeCell.boundingBox();
  expect(cbox!.height).toBeLessThan(48);

  // Nome do cliente em caixa normal.
  await expect(row).toContainText(`E2e Cliente Lista ${suffix.charAt(0)}${suffix.slice(1).toLowerCase()}`);
  await expect(row).not.toContainText(fullName);
});
