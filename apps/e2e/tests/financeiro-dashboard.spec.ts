import { expect, test } from '@playwright/test';
import { gql, expectNoUserErrors } from '../support/graphql';
import {
  addMoney,
  brl,
  createClient,
  createProfessional,
  createVisit,
  methodTotal,
  normalizeSpaces,
  ownerToken,
  spDate,
  spInstant,
  todaySummary,
  type Summary,
} from '../support/phase3';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

const PAY = `mutation($i: AddComandaPaymentInput!) {
  addComandaPayment(input: $i) { errors { code message } }
}`;
const CLOSE = `mutation($id: UUID!) { closeComanda(id: $id) { comanda { id status } errors { code message } } }`;

/** Próximo horário cheio, 1 h à frente, no fuso SP; se passar das 21h usa amanhã 10:00. */
function visitSlot(): { day: string; from: string; to: string } {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );
  const start = hour + 1;
  if (start >= 7 && start <= 20) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return { day: spDate(0), from: `${pad(start)}:00`, to: `${pad(start + 1)}:00` };
  }
  return { day: spDate(1), from: '10:00', to: '11:00' };
}

test.describe('Financeiro: dashboard Faturado x Recebido (critério #4)', () => {
  let seed: SeedState;
  let after: Summary;
  let expectedBilled: string;
  let expectedReceived: string;
  let expectedPix: string;
  let expectedCash: string;

  test.beforeAll(async () => {
    seed = readSeedState();
    const token = await ownerToken(seed);
    const pro = await createProfessional(seed, token, 'Fin');
    const { servicePrice, serviceId } = seed.phase3; // serviço R$ 80,00
    const { id: clientId } = await createClient(token, 'Fin');

    const before = await todaySummary(token);

    // sinal Pix 50 -> crédito; pagamentos: crédito 50, pix (total - 50 - 20), dinheiro 30 (troco 10)
    const slot = visitSlot();
    const visit = await createVisit(token, {
      clientId,
      serviceId,
      professionalId: pro.id,
      startsAt: spInstant(slot.day, slot.from),
      endsAt: spInstant(slot.day, slot.to),
      deposit: { amount: '50.00', method: 'pix' },
    });
    expect(visit.errors).toEqual([]);
    const comandaId = visit.comandaId!;

    const pixAmount = (Number(servicePrice) - 50 - 20).toFixed(2); // 10,00
    for (const [method, amount] of [
      ['client_credit', '50.00'],
      ['pix', pixAmount],
      ['cash', '30.00'],
    ]) {
      const paid = await gql<{ addComandaPayment: { errors: never[] } }>(
        PAY,
        { i: { comandaId, method, amount } },
        { token },
      );
      expectNoUserErrors(paid.addComandaPayment, `addComandaPayment ${method}`);
    }
    const closed = await gql<{ closeComanda: { comanda: { status: string } | null; errors: never[] } }>(
      CLOSE,
      { id: comandaId },
      { token },
    );
    expectNoUserErrors(closed.closeComanda, 'closeComanda');
    expect(closed.closeComanda.comanda!.status).toBe('closed');

    after = await todaySummary(token);

    // D-22: Faturado pela data de fechamento; Recebido pela data do movimento (ambos hoje).
    // Recebido = sinal pix 50 + pix + dinheiro 30 - troco 10 (crédito não entra no caixa).
    expectedBilled = addMoney(before.billedTotal, servicePrice);
    expectedReceived = addMoney(before.receivedTotal, 50, pixAmount, 30, -10);
    expectedPix = addMoney(methodTotal(before, 'pix'), 50, pixAmount);
    expectedCash = addMoney(methodTotal(before, 'cash'), 30, -10);

    expect(after.billedTotal).toBe(expectedBilled);
    expect(after.receivedTotal).toBe(expectedReceived);
    expect(methodTotal(after, 'pix')).toBe(expectedPix);
    expect(methodTotal(after, 'cash')).toBe(expectedCash);
  });

  test('dono vê Faturado, Recebido, forma de pagamento e gráfico coerentes com a API', async ({
    page,
  }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Financeiro', 'Controle de entrada e saída');
    await page.getByTestId('period-preset-today').click();

    await expect(page.getByTestId('kpi-billed')).toContainText(brl(after.billedTotal));
    await expect(page.getByTestId('kpi-received')).toContainText(brl(after.receivedTotal));
    await expect(page.getByTestId('received-method-pix')).toContainText(brl(methodTotal(after, 'pix')));
    await expect(page.getByTestId('received-method-cash')).toContainText(
      brl(methodTotal(after, 'cash')),
    );
    await expect(page.getByTestId('financial-chart').locator('.recharts-bar-rectangle').first()).toBeVisible();

    // trocar a granularidade não muda os totais do período
    for (const granularity of ['week', 'month'] as const) {
      await page.getByTestId(`granularity-${granularity}`).click();
      await expect(page.getByTestId('kpi-billed')).toContainText(brl(after.billedTotal));
      await expect(page.getByTestId('kpi-received')).toContainText(brl(after.receivedTotal));
    }
    expect(normalizeSpaces(await page.getByTestId('kpi-billed').innerText())).toContain('R$');
  });
});
