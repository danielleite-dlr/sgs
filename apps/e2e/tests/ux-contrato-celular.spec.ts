import { expect, test } from '@playwright/test';
import { ownerToken } from '../support/phase3';
import {
  createBridalPackage,
  createBrideContractViaUi,
  firstWednesdayFromNow,
  recordContractPayment,
  setStudioSettings,
} from '../support/phase4';
import { readSeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

// UX-12: contrato no celular com cartões empilhados e valores em R$ sem quebra de linha.
test('UX-12: no celular o contrato mostra cartões e nenhum valor quebra em duas linhas', async ({
  browser,
}) => {
  const seed = readSeedState();
  const token = await ownerToken(seed);
  const unique = Date.now().toString(36);
  const pkg = await createBridalPackage(seed, token, {
    price: '2036.36',
    depositPercent: '30',
    name: `Pacote Celular ${unique}`,
  });
  await setStudioSettings(token);

  const desktop = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await loginViaUi(desktop, seed.owner.email, seed.owner.password);
  const contractId = await createBrideContractViaUi(desktop, {
    brideName: `Noiva Celular ${unique}`,
    packageId: pkg.id,
    eventDate: firstWednesdayFromNow(60),
  });
  await desktop.close();
  await recordContractPayment(token, contractId, [{ method: 'pix', amount: '1018.18' }]);

  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true });
  const page = await ctx.newPage();
  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await page.goto(`/contratos/${contractId}`);

  await expect(page.getByTestId('contract-items-cards')).toBeVisible();
  await expect(page.getByTestId('contract-installments-cards')).toBeVisible();
  await expect(page.getByTestId('contract-payments-cards')).toBeVisible();
  await expect(page.getByTestId('contract-items-table')).toBeHidden();
  await expect(page.getByTestId('contract-payments')).toBeHidden();
  await expect(page.getByTestId('contract-payments-cards')).toContainText('R$ 1.018,18');
  await expect(page.getByTestId('contract-values')).toContainText('pendente R$ 1.018,18');

  // Nenhum "R$ ..." visível ocupa mais de uma linha (linhas = topos distintos do texto).
  const quebrados = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? '';
      if (!/R\$\s?-?\d/.test(text)) continue;
      // Texto corrido das cláusulas pode quebrar; o critério vale para valores de tabela/cartão.
      if (n.parentElement?.closest('[data-testid="contract-text"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (rects.length === 0) continue;
      const linhas = new Set(rects.map((r) => Math.round(r.top))).size;
      if (linhas > 1) out.push(`${text.trim()} (${linhas} linhas)`);
    }
    return out;
  });
  expect(quebrados).toEqual([]);

  const larguras = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(larguras.scroll).toBeLessThanOrEqual(larguras.client);
  await ctx.close();
});
