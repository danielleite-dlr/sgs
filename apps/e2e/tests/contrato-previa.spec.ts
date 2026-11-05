import { readFileSync } from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';
import { gql } from '../support/graphql';
import { ownerToken } from '../support/phase3';
import {
  firstWednesdayFromNow,
  LETTERHEAD_PNG,
  setStudioSettings,
  uploadLetterhead,
} from '../support/phase4';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

/**
 * Quick 261105-d6k: prévia do contrato em PDF enquanto a usuária preenche
 * Contratos > Novo contrato — sem gravar nada.
 */

test.describe.configure({ mode: 'serial' });

let seed: SeedState;
let token: string;
const unique = Date.now().toString(36);
const eventDate = firstWednesdayFromNow(55);

test.beforeAll(async () => {
  seed = readSeedState();
  token = await ownerToken(seed);
  await setStudioSettings(token);
  await uploadLetterhead(token, LETTERHEAD_PNG);
});

async function openNewContract(page: Page, brideName: string, opts: { mobile?: boolean } = {}) {
  await loginViaUi(page, seed.owner.email, seed.owner.password);
  // no celular o menu lateral fica recolhido: vai direto pela URL
  if (opts.mobile) await page.goto('/contratos');
  else await navigateViaMenu(page, 'Eventos', 'Contratos');
  await page.getByTestId('new-contract').click();
  await expect(page.getByRole('heading', { name: 'Novo contrato' })).toBeVisible();
  await page.getByTestId('nc-kind-noiva').check();
  await page.getByTestId('nc-bride-name').fill(brideName);
  await page.getByTestId('nc-bride-phone').fill('11987654321');
  await page.getByTestId('nc-date').fill(eventDate);
  await page.locator('#contract-add-member').selectOption({ index: 1 });
  await page.locator('#contract-add-service').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
}

/** Nada com o nome da noiva foi gravado: contrato, grupo ou cliente. */
async function expectNothingSaved(brideName: string) {
  const data = await gql<{
    contracts: { brideName: string | null }[];
    bridalGroups: { name: string }[];
    clients: { totalCount: number };
  }>(
    `query($s: String) {
      contracts { brideName }
      bridalGroups { name }
      clients(search: $s) { totalCount }
    }`,
    { s: brideName },
    { token },
  );
  expect(data.contracts.filter((c) => c.brideName?.includes(brideName))).toEqual([]);
  expect(data.bridalGroups.filter((g) => g.name.includes(brideName))).toEqual([]);
  expect(data.clients.totalCount).toBe(0);
}

test.describe('Prévia do contrato — telas largas', () => {
  test.use({ viewport: { width: 1600, height: 1500 } });

  test('PDF ao lado do formulário, atualiza com as mudanças e não grava nada', async ({ page }) => {
    const brideName = `Noiva Previa ${unique}`;
    await openNewContract(page, brideName);

    const frame = page.getByTestId('contract-preview-frame');
    await expect(frame).toHaveAttribute('src', /^blob:/, { timeout: 15_000 });
    const first = (await frame.getAttribute('src')) as string;
    const pdf = await page.evaluate(async (src) => {
      const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
      return { head: String.fromCharCode(...buf.slice(0, 5)), size: buf.length };
    }, first);
    expect(pdf.head).toBe('%PDF-');
    // papel timbrado da org (mesmo renderizador do "Baixar PDF")
    expect(pdf.size).toBeGreaterThan(10_000);

    await page.locator('#contract-discount').fill('500');
    await expect(page.getByTestId('contract-form-total')).not.toHaveText('R$ 0,00');
    await expect(frame).not.toHaveAttribute('src', first, { timeout: 15_000 });
    await expect(page.getByTestId('contract-preview-error')).toHaveCount(0);
    const second = (await frame.getAttribute('src')) as string;
    expect(second).toMatch(/^blob:/);

    await page.getByRole('button', { name: 'Atualizar prévia' }).click();
    await expect(frame).not.toHaveAttribute('src', second, { timeout: 15_000 });
    await expect(page.getByTestId('contract-preview-status')).toHaveText('');

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('contract-form')).toBeHidden();
    await expectNothingSaved(brideName);
  });
});

test.describe('Prévia do contrato — celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sem visualizador embutido; Ver prévia abre o PDF numa nova aba', async ({ page, context }) => {
    const brideName = `Noiva Previa Cel ${unique}`;
    await openNewContract(page, brideName, { mobile: true });
    await expect(page.getByTestId('contract-preview-frame')).toHaveCount(0);

    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.getByTestId('contract-preview-open').click(),
    ]);
    // A aba nova navega para o blob do PDF; sem visualizador de PDF (Chromium headless,
    // muitos Android) o navegador baixa o arquivo em vez de exibir — as duas saídas valem.
    let download: Download | null = null;
    popup.on('download', (d) => {
      download = d;
    });
    await expect
      .poll(() => (download ? download.url() : popup.url()), { timeout: 15_000 })
      .toMatch(/^blob:/);
    if (download) {
      const file = await (download as Download).path();
      expect(readFileSync(file).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    }
    await popup.close();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expectNothingSaved(brideName);
  });
});
