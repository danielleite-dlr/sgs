import { expect, test, type Page } from '@playwright/test';
import { gql, expectNoUserErrors } from '../support/graphql';
import { createClient, createProfessional, ownerToken } from '../support/phase3';
import { readSeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

// Comanda e caixa (lote 2): UX-09 (comanda no celular) e UX-10 (HTML do menu).
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const AVISO_HTML = /validateDOMNesting|cannot appear as a descendant of|cannot be a child of/;

function coletarAvisos(page: Page): string[] {
  const avisos: string[] = [];
  page.on('console', (msg) => {
    if (AVISO_HTML.test(msg.text())) avisos.push(msg.text().slice(0, 200));
  });
  return avisos;
}

test('UX-09: no celular os itens vêm logo abaixo do cliente e o nome cabe em até 2 linhas', async ({
  page,
}) => {
  const seed = readSeedState();
  const token = await ownerToken(seed);
  const pro = await createProfessional(seed, token, 'Cel');
  const { id: clientId } = await createClient(token, 'Cel');

  // Nome de 25 caracteres (18 fixos + 7 únicos por execução).
  const suffix = Date.now().toString(36).slice(-7).toUpperCase().padStart(7, '0');
  const itemName = `Kit Hidratação XG ${suffix}`;
  expect(itemName).toHaveLength(25);
  const product = await gql<{
    createProduct: { product: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: CreateProductInput!) {
      createProduct(input: $input) { product { id } errors { code message } }
    }`,
    {
      input: {
        name: itemName,
        sku: `E2E-CEL-${suffix}`,
        costPrice: '40.00',
        salePrice: '120.00',
        stockQuantity: 5,
        minStockLevel: 1,
        unit: 'un',
      },
    },
    { token },
  );
  expectNoUserErrors(product.createProduct, 'createProduct');

  const opened = await gql<{
    openWalkInComanda: { comanda: { id: string } | null; errors: never[] };
  }>(
    `mutation($input: OpenWalkInComandaInput!) {
      openWalkInComanda(input: $input) { comanda { id } errors { code message } }
    }`,
    { input: { clientId } },
    { token },
  );
  expectNoUserErrors(opened.openWalkInComanda, 'openWalkInComanda');
  const comandaId = opened.openWalkInComanda.comanda!.id;

  const added = await gql<{ addComandaItem: { errors: never[] } }>(
    `mutation($input: AddComandaItemInput!) {
      addComandaItem(input: $input) { errors { code message } }
    }`,
    {
      input: {
        comandaId,
        kind: 'product',
        productId: product.createProduct.product!.id,
        professionalId: pro.id,
        quantity: 1,
      },
    },
    { token },
  );
  expectNoUserErrors(added.addComandaItem, 'addComandaItem');

  const avisos = coletarAvisos(page);
  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await page.goto(`/comanda/${comandaId}`);

  const itensTitulo = page.getByText('Itens da comanda', { exact: true });
  const adicionarTitulo = page.getByText('Adicionar à comanda', { exact: true });
  await expect(itensTitulo).toBeVisible();
  await expect(adicionarTitulo).toBeAttached();

  const yItens = await itensTitulo.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const yAdicionar = await adicionarTitulo.evaluate(
    (el) => el.getBoundingClientRect().top + window.scrollY,
  );
  expect(yItens, `Itens em ${yItens}px, Adicionar em ${yAdicionar}px`).toBeLessThan(yAdicionar);

  const nome = page.getByText(itemName, { exact: true });
  await nome.scrollIntoViewIfNeeded();
  const linhas = await nome.evaluate((el) => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    return Math.round(el.getBoundingClientRect().height / lh);
  });
  expect(linhas, `nome do item em ${linhas} linhas`).toBeLessThanOrEqual(2);

  // UX-10: nenhuma tela aberta gera aviso de HTML inválido.
  expect(avisos).toEqual([]);
});

test('UX-10: menu e trilha do topo sem aviso de HTML inválido no console', async ({ page }) => {
  const seed = readSeedState();
  const avisos = coletarAvisos(page);
  await loginViaUi(page, seed.owner.email, seed.owner.password);
  // Telas com trilha no topo (onde o aviso aparecia) e telas sem.
  for (const rota of ['/agenda', '/comanda', '/financeiro', '/financeiro/comissoes', '/clientes']) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }
  // Abre o menu do celular (gaveta), que também tem a lista de navegação.
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const rota of ['/agenda', '/comanda']) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }
  expect(avisos).toEqual([]);
});
