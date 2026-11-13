import { expect, test } from '@playwright/test';
import { gql } from '../support/graphql';
import { openAgendaAt, openDeposit, pickProfessional } from '../support/agenda-ui';
import {
  brl,
  createClient,
  createProfessional,
  daysUntilNextWednesday,
  normalizeSpaces,
  ownerToken,
  spDate,
  type CreatedPro,
} from '../support/phase3';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

const text = async (locator: import('@playwright/test').Locator) =>
  normalizeSpaces(await locator.innerText());

test.describe('Fluxo: agendamento com sinal, comanda, pagamento dividido e comissão (critérios #2 e #3)', () => {
  let seed: SeedState;
  let pro: CreatedPro;
  let client: { id: string; name: string };
  let token: string;
  const ahead = daysUntilNextWednesday();

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
    pro = await createProfessional(seed, token, 'Fluxo');
    client = await createClient(token, 'Fluxo');
  });

  test('sinal R$ 50,00 vira crédito, pagamento Pix + Dinheiro com troco, fechamento gera comissão congelada', async ({
    page,
    browser,
  }) => {
    const { servicePrice, productPrice, productId, serviceId } = seed.phase3;
    const { id: clientId, name: clientName } = client;
    const total = Number(servicePrice) + Number(productPrice); // 80 + 35 = 115
    const pixAmount = total - 100; // 15: crédito 50 + pix 15 + dinheiro 60 = 125 (troco 10)

    const readStock = async () =>
      (
        await gql<{ product: { stockQuantity: number } }>(
          `query($id: UUID!) { product(id: $id) { stockQuantity } }`,
          { id: productId },
          { token },
        )
      ).product.stockQuantity;
    const stockBefore = await readStock();

    // ---- agendamento com sinal pela interface ----
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await openAgendaAt(page, ahead);
    const slot = page.getByTestId(`slot-${pro.id}-09:00`);
    await slot.scrollIntoViewIfNeeded();
    await slot.click();
    await expect(page.getByTestId('visit-form')).toBeVisible();
    await page.getByTestId('visit-client-search').fill(clientName);
    await page.getByTestId(`visit-client-option-${clientId}`).click();
    await page.getByTestId('visit-line-0-service').selectOption(serviceId);
    await pickProfessional(page, 0, pro.id);
    await openDeposit(page);
    await page.getByTestId('visit-deposit-amount').fill('5000');
    await expect(page.getByTestId('visit-deposit-amount')).toHaveValue('50,00');
    await page.getByTestId('visit-deposit-method').selectOption('pix');
    await page.getByTestId('visit-submit').click();
    await expect(page.getByText(/Comanda C-\d{4}-\d+ aberta/)).toBeVisible();

    // ---- abre a comanda pelo card ----
    const card = page.getByTestId(`lane-${pro.id}`).locator('[data-testid^="appointment-card-"]');
    await expect(card).toHaveCount(1);
    await card.click();
    await expect(page.getByTestId('appointment-details')).toBeVisible();
    await page.getByTestId('appointment-open-comanda').click();
    await page.waitForURL(/\/comanda\/[0-9a-f-]+\?agenda=\d{4}-\d{2}-\d{2}&visao=day$/);
    expect(page.url()).toContain(`agenda=${spDate(ahead)}&visao=day`);
    const comandaId = new URL(page.url()).pathname.split('/').pop()!;
    const comandaCode = (await text(page.getByRole('heading', { level: 1 }))).match(/C-\d{4}-\d+/)![0];

    // ---- produto ----
    await page.getByTestId('comanda-add-product').click();
    await page.getByTestId('add-item-product').selectOption(productId);
    await page.getByTestId('add-item-professional').selectOption(pro.id);
    await page.getByTestId('add-item-quantity').fill('1');
    await page.getByTestId('add-item-submit').click();
    await expect(page.getByTestId('payment-total')).toHaveText(brl(total));

    // ---- pagamento dividido ----
    const useCredit = page.getByTestId('payment-use-credit');
    await expect(useCredit).toContainText('R$ 50,00');
    await useCredit.click();
    await expect(page.getByTestId('payment-remaining')).toHaveText(brl(total - 50));

    await page.getByTestId('payment-method-select').selectOption('pix');
    await page.getByTestId('payment-amount').fill(String(Math.round(pixAmount * 100)));
    await page.getByTestId('payment-add').click();
    await expect(page.getByTestId('payment-remaining')).toHaveText(brl(total - 50 - pixAmount));
    // o formulário só volta ao valor sugerido (falta) depois de o lançamento terminar:
    // digitar antes disso seria sobrescrito pelo reset do campo.
    await expect(page.getByTestId('payment-amount')).toHaveValue(
      (total - 50 - pixAmount).toFixed(2).replace('.', ','),
    );

    await page.getByTestId('payment-method-select').selectOption('cash');
    await page.getByTestId('payment-amount').fill('6000');
    await page.getByTestId('payment-add').click();
    await expect(page.getByTestId('payment-remaining')).toHaveText(brl(0));
    await expect(page.getByTestId('payment-change')).toHaveText(brl(10));
    expect(await text(page.getByTestId('payment-change'))).not.toBe('R$ 0,00');

    // ---- fechamento ----
    await page.getByTestId('comanda-close').click();
    await expect(page.getByTestId('comanda-status')).toHaveText('Fechada');
    const commissions = page.getByTestId('comanda-commissions');
    await expect(commissions).toContainText(pro.name);
    await expect(commissions).toContainText(brl(Number(servicePrice) * 0.4)); // 40% do preço cheio

    // ---- volta para a agenda no mesmo dia ----
    await page.getByTestId('comanda-back-to-agenda').click();
    await page.waitForURL(new RegExp(`/agenda\\?data=${spDate(ahead)}&visao=day$`));
    await expect(page.getByTestId('view-day')).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByTestId(`lane-${pro.id}`).locator('[data-testid^="appointment-card-"]'),
    ).toHaveCount(1);

    // ---- verificações pela API ----
    expect(await readStock()).toBe(stockBefore - 1);

    const fetchRecords = async () => {
      const data = await gql<{
        commissionRecords: {
          comandaCode: string;
          memberId: string;
          itemName: string;
          kind: string;
          noRule: boolean;
          calculatedAmount: string;
          ruleSnapshot: string;
        }[];
      }>(
        `query($f: String!, $t: String!, $m: UUID) {
          commissionRecords(from: $f, to: $t, memberId: $m) {
            comandaCode memberId itemName kind noRule calculatedAmount ruleSnapshot
          }
        }`,
        { f: spDate(-1), t: spDate(2), m: pro.id },
        { token },
      );
      return data.commissionRecords.filter((r) => r.comandaCode === comandaCode);
    };
    const before = await fetchRecords();
    const serviceRecord = before.find((r) => !r.noRule);
    expect(serviceRecord).toBeDefined();
    expect(serviceRecord!.calculatedAmount).toBe('32.00');
    const snapshot = JSON.parse(serviceRecord!.ruleSnapshot) as { kind: string; value: string };
    expect(snapshot.kind).toBe('percentage');
    expect(Number(snapshot.value)).toBe(40);

    // alterar a regra depois do fechamento não muda o valor já calculado
    const update = async (value: string) =>
      gql(
        `mutation($i: UpdateCommissionRuleInput!) { updateCommissionRule(input: $i) { errors { code message } } }`,
        { i: { id: seed.phase3.commissionRuleId, value } },
        { token },
      );
    try {
      await update('50.00');
      const after = await fetchRecords();
      expect(after.find((r) => !r.noRule)!.calculatedAmount).toBe('32.00');
    } finally {
      await update('40.00');
    }

    // ---- o profissional vê só o próprio registro ----
    const proContext = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const proPage = await proContext.newPage();
    await loginViaUi(proPage, pro.email, pro.password);
    await navigateViaMenu(proPage, 'Financeiro', 'Comissões calculadas');
    const rows = proPage.locator('[data-testid^="commission-record-"]');
    await expect(rows.first()).toBeVisible();
    await expect(proPage.getByTestId('commission-records')).toContainText(comandaCode);
    await expect(proPage.getByTestId('commission-member-select')).toHaveCount(0);
    expect(comandaId).toBeTruthy();
    await proContext.close();
  });
});
