import { expect, test } from '@playwright/test';
import { gql } from '../support/graphql';
import { brl, createProfessional, ownerToken } from '../support/phase3';
import {
  addDaysYmd,
  contractBilledToday,
  createBridalPackage,
  extractAcceptLink,
  fillClientContractFields,
  firstWednesdayFromNow,
  groupAppointments,
  groupClientIds,
  LETTERHEAD_PNG,
  readDownload,
  reacceptContract,
  runContractAlertsNow,
  setBalanceDueDaysBefore,
  setStudioSettings,
  spDate,
  uploadLetterhead,
  ymdToBr,
} from '../support/phase4';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

const VALID_CPF = '52998224725';

function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000);
}

test.describe.configure({ mode: 'serial' });

test.describe('Fase 4: pacote -> grupo de noivas -> contrato -> aceite público -> pagamentos -> agenda IA -> alertas -> cancelamento', () => {
  let seed: SeedState;
  let token: string;
  let pkg: { id: string; name: string };
  const unique = Date.now().toString(36);
  const eventDate = firstWednesdayFromNow(40);
  const groupName = `Casamento E2E ${unique}`;
  const brideName = `Noiva E2E ${unique}`;
  const companionNames = [1, 2, 3, 4].map((i) => `Acompanhante ${i} E2E ${unique}`);
  let groupId = '';
  let contractId = '';
  let contractCode = '';
  let acceptUrl = '';
  let brideClientId = '';

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
    // profissional exclusivo: a heurística da agenda precisa de alguém que faça o serviço
    await createProfessional(seed, token, 'Noivas');
    pkg = await createBridalPackage(seed, token, { price: '8000.00', depositPercent: '30' });
    // configurações do contrato: dados do studio e papel timbrado (04.1)
    await setStudioSettings(token);
    await uploadLetterhead(token, LETTERHEAD_PNG);
  });

  test('grupo com noiva e 4 acompanhantes, contrato do pacote e link de aceite', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);

    // ---- grupo de noivas pela UI ----
    await navigateViaMenu(page, 'Eventos', 'Grupos de Noivas');
    await expect(page).toHaveURL(/\/noivas$/);
    await page.getByTestId('new-group').click();
    await page.getByTestId('bg-name').fill(groupName);
    await page.getByTestId('bg-date').fill(eventDate);
    await page.getByTestId('bg-ready').fill('15:00');
    await page.getByTestId('group-event-time').fill('16:00');

    await page.getByTestId('bride-name').fill(brideName);
    await page.getByTestId('bride-add-service').selectOption(seed.phase3.serviceId);

    for (let i = 0; i < 4; i += 1) {
      await page.getByTestId('bg-add-companion').click();
      await page.getByTestId(`companion-${i}-name`).fill(companionNames[i]);
      if (i < 2) await page.getByTestId(`companion-${i}-phone`).fill('11987654321');
      if (i > 0) await page.getByTestId(`companion-${i}-add-service`).selectOption(seed.phase3.serviceId);
    }
    // a primeira acompanhante é a mãe, incluída no contrato
    await page.locator('#companion-0-relation').fill('Mãe');
    await page.getByTestId('companion-0-covered').check();

    await page.getByTestId('bg-submit').click();
    await page.waitForURL(/\/noivas\/[0-9a-f-]{36}$/);
    groupId = page.url().split('/').pop()!;

    // critério 1: detalhe com 5 pessoas
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();
    await expect(page.locator('[data-testid^="member-"]:not([data-testid="members-errors"])')).toHaveCount(5);
    await expect(page.getByText(brideName).first()).toBeVisible();

    // ---- ficha da cliente pela UI (sem Celular 2 por enquanto) ----
    brideClientId = (await groupClientIds(token, groupId)).brideClientId;
    await fillClientContractFields(page, brideClientId, {
      cpf: '529.982.247-25',
      rg: '12.345.678-9',
      postalCode: '06083-290',
      address: 'Rua das Flores, 10 - Osasco/SP',
      phone: '11987654321',
    });
    await page.goto(`/noivas/${groupId}`);
    await expect(page.getByTestId('bg-detail-event-time')).toContainText('16:00');

    // ---- contrato: pacote, sinal parcelado e desconto descrito ----
    await page.getByTestId('create-contract').click();
    await expect(page.getByRole('heading', { name: 'Novo contrato' })).toBeVisible();
    await page.locator('#contract-package').selectOption(pkg.id);
    await page.locator('#contract-days').fill('10');
    await page.locator('#contract-discount').fill('10000');
    await page.locator('#contract-discount-description').fill('10% OFF');
    await expect(page.getByTestId('contract-form-total')).toHaveText(brl('7900.00'));
    await expect(page.locator('#contract-deposit')).toHaveValue('2.370,00');
    await page.locator('#contract-deposit').fill('240000');
    await page.locator('#contract-mode-sinal_parcelado').click();
    const firstDue = addDaysYmd(spDate(0), -2);
    const secondDue = spDate(20);
    await page.locator('#installment-date-1').fill(firstDue);
    await page.locator('#installment-amount-1').fill('120000');
    await page.getByRole('button', { name: 'Adicionar parcela' }).click();
    await page.locator('#installment-date-2').fill(secondDue);
    // soma errada: 1.200 + 1.300 != 2.400
    await page.locator('#installment-amount-2').fill('130000');
    await expect(page.getByTestId('installments-sum')).toContainText(`Soma ${brl('2500.00')}`);
    await expect(page.getByTestId('installments-error')).toContainText('deve ser igual ao sinal');
    await expect(page.getByTestId('contract-submit')).toBeDisabled();
    await page.locator('#installment-amount-2').fill('120000');
    await expect(page.getByTestId('installments-error')).toHaveCount(0);
    await page.getByTestId('contract-submit').click();

    await page.waitForURL(/\/contratos\/[0-9a-f-]{36}$/);
    contractId = page.url().split('/').pop()!;
    await expect(page.getByRole('heading', { name: /Contrato CT-/ })).toBeVisible();
    contractCode = (await page.getByRole('heading', { name: /Contrato CT-/ }).innerText()).match(/CT-\d{4}-\d+/)![0];
    await expect(page.getByTestId('contract-total')).toHaveText(brl('7900.00'));
    await expect(page.getByTestId('contract-due')).toContainText(ymdToBr(addDaysYmd(eventDate, -10)));
    await expect(page.getByText('Entrada pendente')).toBeVisible();
    const installments = page.getByTestId('contract-installments');
    await expect(installments).toContainText('Sinal parcelado');
    await expect(installments).toContainText('SINAL 1/2');
    await expect(installments).toContainText('SINAL 2/2');
    await expect(installments).toContainText('Desconto: 10% OFF');

    // ---- gate D-09: falta o Celular 2 e o link fica bloqueado ----
    await expect(page.getByTestId('contract-missing')).toContainText('Celular 2 da contratante');
    await expect(page.getByTestId('contract-generate-link')).toBeDisabled();
    // UX-13: completa o Celular 2 num diálogo, sem sair do contrato.
    await page.getByTestId('contract-complete-contractor').click();
    const completeDialog = page.getByRole('dialog');
    await completeDialog.getByLabel('Celular 2').fill('11911112222');
    await completeDialog.getByRole('button', { name: 'Salvar dados' }).click();
    await expect(completeDialog).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/contratos/${contractId}$`));
    await expect(page.getByTestId('contract-generate-link')).toBeEnabled();
    await expect(page.getByTestId('contract-missing')).toHaveCount(0);
  });

  test('baixar PDF antes do aceite, editar só o desconto e gerar o link', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/contratos/${contractId}`);

    // PDF do rascunho (não aceito)
    const [draftPdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Baixar PDF (não aceito)' }).click(),
    ]);
    expect((await readDownload(draftPdf)).subarray(0, 4).toString('latin1')).toBe('%PDF');

    // D-05: editar só o desconto preserva os itens marcados "Pacote"
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByTestId('contract-items').getByText('Pacote', { exact: true }).first()).toBeVisible();
    await page.locator('#contract-discount').fill('15000');
    await page.getByTestId('contract-submit').click();
    await expect(page.getByTestId('contract-total')).toHaveText(brl('7850.00'));
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByTestId('contract-items').getByText('Pacote', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

    // ---- link de aceite ----
    await page.getByTestId('contract-generate-link').click();
    acceptUrl = await extractAcceptLink(page);
    expect(acceptUrl).toContain(`/aceite/${seed.orgId}/`);
  });

  test('aceite público da noiva em contexto anônimo e PDF', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'pt-BR' });
    const pub = await context.newPage();
    try {
      await pub.goto(acceptUrl);
      await expect(pub.getByRole('heading', { name: new RegExp(`Contrato ${contractCode}`) })).toBeVisible();
      const text = pub.getByLabel('Texto do contrato');
      await expect(text).toContainText(brideName);
      await expect(text).toContainText('Pacote contratado');
      await expect(text).toContainText('10% OFF');
      await expect(text).toContainText('SINAL 1/2');
      await expect(text).toContainText('RESTANTE PAGAMENTO');

      await pub.locator('#accept-name').fill(brideName);
      await pub.locator('#accept-cpf').fill(VALID_CPF);
      await pub.locator('#accept-terms').check();
      await pub.getByRole('button', { name: 'Aceito' }).click();
      await expect(pub.getByText(/^Contrato aceito em/)).toBeVisible();

      const [download] = await Promise.all([
        pub.waitForEvent('download'),
        pub.getByRole('link', { name: 'Baixar PDF' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^NOIVA_.+\.pdf$/);
      expect((await readDownload(download)).subarray(0, 4).toString('latin1')).toBe('%PDF');
    } finally {
      await context.close();
    }
  });

  test('pagamentos do contrato e Faturado no financeiro', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/contratos/${contractId}`);
    await expect(page.getByTestId('acceptance-info')).toContainText('Aceito em');
    await expect(page.getByRole('button', { name: 'Baixar PDF' })).toBeVisible();

    // 1ª parcela (R$ 1.200,00, vencida há 2 dias): paga; a 2ª segue em aberto
    const installments = page.getByTestId('contract-installments');
    await expect(installments.locator('tr', { hasText: 'SINAL 1/2' })).toContainText('Vencida');
    await page.getByRole('button', { name: 'Registrar pagamento' }).click();
    await page.locator('#cp-method-0').selectOption('pix');
    await page.locator('#cp-amount-0').fill('120000');
    await page.getByTestId('cp-submit').click();
    await expect(page.getByTestId('contract-paid')).toHaveText(brl('1200.00'));
    await expect(installments.locator('tr', { hasText: 'SINAL 1/2' })).toContainText('Paga');
    await expect(installments.locator('tr', { hasText: 'SINAL 2/2' })).toContainText('Em aberto');

    // estorno: a 1ª parcela volta a vencida e o alerta aparece no sino
    await page.getByRole('button', { name: `Estornar pagamento de ${brl('1200.00')}` }).click();
    await page.locator('#reverse-reason').fill('Estorno de teste E2E');
    await page.getByTestId('reverse-submit').click();
    await expect(page.getByTestId('contract-paid')).toHaveText(brl('0.00'));
    await expect(installments.locator('tr', { hasText: 'SINAL 1/2' })).toContainText('Vencida');
    const run = await runContractAlertsNow(token);
    expect(run.created).toBeGreaterThanOrEqual(1);
    await page.reload();
    await page.getByRole('button', { name: 'Notificações' }).click();
    await expect(page.getByRole('button', { name: /Parcela do sinal vencida/ }).first()).toBeVisible();
    await page.keyboard.press('Escape');

    // sinal completo R$ 2.400,00 no Pix
    await page.getByRole('button', { name: 'Registrar pagamento' }).click();
    await page.locator('#cp-method-0').selectOption('pix');
    await page.locator('#cp-amount-0').fill('240000');
    await page.getByTestId('cp-submit').click();
    await expect(page.getByTestId('contract-paid')).toHaveText(brl('2400.00'));
    await expect(page.getByText('Entrada pendente')).toHaveCount(0);
    await expect(installments.locator('tr', { hasText: 'SINAL 2/2' })).toContainText('Paga');

    // R$ 3.000,00 em duas linhas: dinheiro + débito
    await page.getByRole('button', { name: 'Registrar pagamento' }).click();
    await page.locator('#cp-method-0').selectOption('cash');
    await page.locator('#cp-amount-0').fill('100000');
    await page.getByRole('button', { name: 'Adicionar forma de pagamento' }).click();
    await page.locator('#cp-method-1').selectOption('debit_card');
    await page.locator('#cp-amount-1').fill('200000');
    await page.getByTestId('cp-submit').click();
    await expect(page.getByTestId('contract-paid')).toHaveText(brl('5400.00'));
    await expect(page.getByTestId('contract-balance')).toHaveText(brl('2450.00'));

    // dashboard financeiro: Faturado inclui o valor de contratos
    const billedByContracts = await contractBilledToday(token);
    expect(Number(billedByContracts)).toBeGreaterThanOrEqual(5400);
    await navigateViaMenu(page, 'Financeiro', 'Controle de entrada e saída');
    await expect(page.getByTestId('kpi-billed-extra')).toContainText(
      `inclui ${brl(billedByContracts)} de contratos`,
    );
  });

  test('Sugerir agenda IA sem chave (sugestão simples), confirmar e ver na agenda', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/noivas/${groupId}`);
    await page.getByRole('tab', { name: 'Agenda do evento' }).click();
    await page.getByRole('button', { name: 'Sugerir agenda IA' }).click();
    await expect(page.getByText('IA não configurada — sugestão simples.')).toBeVisible();
    await expect(page.getByTestId('ai-errors')).toHaveText('');
    await page.getByRole('button', { name: 'Confirmar agenda' }).click();

    // lista de agendamentos: a noiva está coberta pelo contrato
    await expect(page.getByText('Agenda do evento criada')).toBeVisible();
    const brideRow = page.locator('[data-testid^="appt-"]', { hasText: brideName });
    await expect(brideRow).toBeVisible();
    await expect(brideRow).toContainText('Coberto pelo contrato');
    await expect(page.locator('[data-testid^="appt-"]')).toHaveCount(4); // noiva + 3 acompanhantes com serviço

    const appts = await groupAppointments(token, groupId);
    expect(appts.filter((a) => a.covered).map((a) => a.clientName)).toEqual([brideName]);

    // /agenda no dia do evento mostra os agendamentos
    // Marca do estúdio no topo do menu lateral (leva ao início).
    await page.getByTestId('sidebar-brand').click();
    await navigateViaMenu(page, 'Agenda', 'Minha agenda');
    await expect(page.getByTestId('view-day')).toBeVisible();
    const next = page.getByRole('button', { name: 'Próximo dia' });
    const hops = daysBetween(spDate(0), eventDate);
    for (let i = 0; i < hops; i += 1) await next.click();
    await expect(page.locator('[data-testid^="appointment-card-"]').first()).toBeVisible();
    expect(await page.locator('[data-testid^="appointment-card-"]').count()).toBeGreaterThanOrEqual(4);
  });

  test('alertas: restante vencendo gera notificação no sino que leva ao contrato', async ({ page }) => {
    // prazo do restante daqui a 2 dias
    const days = daysBetween(spDate(0), eventDate) - 2;
    await setBalanceDueDaysBefore(token, contractId, days);
    // a edição exige novo aceite; sem ele o contrato só geraria o alerta de "não aceito"
    await reacceptContract(token, seed.orgId, contractId, brideName, VALID_CPF);
    const run = await runContractAlertsNow(token);
    expect(run.ran).toBe(true);
    expect(run.created).toBeGreaterThanOrEqual(1);
    // a checagem manual não reenvia o e-mail de resumo (só o tick diário envia;
    // esse caminho é coberto em phase4-contract-alerts.e2e.spec.ts)
    expect(run.emailed).toBe(0);

    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await expect(page.getByTestId('notifications-badge')).toBeVisible();
    const count = Number((await page.getByTestId('notifications-badge').innerText()).replace('+', ''));
    expect(count).toBeGreaterThanOrEqual(1);
    await page.getByRole('button', { name: 'Notificações' }).click();
    const item = page.getByRole('button', { name: /Restante vence em 2 dia/ }).first();
    await expect(item).toBeVisible();
    await item.click();
    await page.waitForURL(new RegExp(`/contratos/${contractId}$`));
  });

  test('cancelar contrato pela noiva: sem devolução, agendamentos cobertos cancelados, avulsas mantidas', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/contratos/${contractId}`);
    await page.getByRole('button', { name: 'Cancelar contrato' }).click();
    await page.getByLabel('Pela noiva').check();
    await expect(page.getByTestId('cancel-preview')).toContainText(`Devolver ${brl('0.00')}`);
    await page.locator('#cancel-reason').fill('Casamento adiado pela noiva (E2E)');
    await page.getByTestId('cancel-submit').click();
    await expect(page.getByText('Contrato cancelado.')).toBeVisible();
    await expect(page.getByText('Cancelado', { exact: true }).first()).toBeVisible();

    const appts = await groupAppointments(token, groupId);
    const bride = appts.find((a) => a.clientName === brideName);
    expect(bride?.status).toBe('cancelled');
    const companions = appts.filter((a) => a.clientName !== brideName);
    expect(companions.length).toBe(3);
    for (const c of companions) expect(c.status).not.toBe('cancelled');

    // o contrato aparece cancelado na API
    const data = await gql<{ contract: { status: string } }>(
      `query($id: UUID!) { contract(id: $id) { status } }`,
      { id: contractId },
      { token },
    );
    expect(data.contract.status).toBe('cancelled');
  });
});
