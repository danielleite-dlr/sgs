import { expect, test } from '@playwright/test';
import { ownerToken } from '../support/phase3';
import { createBridalPackage, todayPlusDays } from '../support/phase4';
import {
  createCommercialDeal,
  createCommercialLead,
  loginToken,
  randomSuffix,
} from '../support/phase9';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('Fase 9: visibilidade do Comercial por papel', () => {
  let seed: SeedState;
  const unique = randomSuffix();
  const managerDealName = `Negócio do gerente ${unique}`;

  test.beforeAll(async () => {
    seed = readSeedState();
    const owner = await ownerToken(seed);
    const managerToken = await loginToken(seed.manager);
    const pkg = await createBridalPackage(seed, owner, {
      price: '4000.00',
      depositPercent: '30',
      name: `Pacote Visibilidade ${unique}`,
    });
    const lead = await createCommercialLead(managerToken, { fullName: managerDealName });
    await createCommercialDeal(managerToken, {
      leadId: lead.id,
      kind: 'noiva',
      packageId: pkg.id,
      eventDate: todayPlusDays(90),
      assigneeMemberId: seed.manager.memberId,
    });
  });

  test('atendente não vê o negócio do gerente nem o menu Relatórios', async ({ page }) => {
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await navigateViaMenu(page, 'Comercial', 'Pipeline');
    await expect(page.getByRole('region', { name: 'Novo', exact: true })).toBeVisible();
    await expect(page.getByText(managerDealName)).toHaveCount(0);

    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav.getByRole('link', { name: 'Leads', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Relatórios', exact: true })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Etapas e formulário', exact: true })).toHaveCount(0);

    // Matriz padrão (D-14): a Atendente não tem Controle/Previsão/Despesas fixas/Comissões.
    for (const label of ['Controle de entrada e saída', 'Previsão de caixa', 'Despesas fixas']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    }

    // Rota sem acesso leva à tela inicial da pessoa (Agenda para a Atendente), sem ir ao login.
    await page.goto('/comercial/relatorios');
    await expect(page).toHaveURL(/\/agenda/);
  });

  test('gerente vê o negócio e o menu Relatórios', async ({ page }) => {
    await loginViaUi(page, seed.manager.email, seed.manager.password);
    await navigateViaMenu(page, 'Comercial', 'Pipeline');
    await expect(
      page.getByRole('region', { name: 'Novo', exact: true }).getByText(managerDealName),
    ).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav.getByRole('link', { name: 'Relatórios', exact: true })).toBeVisible();
  });

  test('profissional não vê o menu Comercial e /comercial redireciona', async ({ page }) => {
    // seed.proEditable ainda tem a senha provisória (login cai em /trocar-senha); o
    // profissional da fase 3 é do mesmo papel (PROFESSIONAL) e já tem a senha definitiva.
    await loginViaUi(page, seed.phase3.proEmail, seed.phase3.proPassword);
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Comercial', exact: true })).toHaveCount(0);
    // Matriz padrão (D-14): sem Noivas/Contratos e sem Financeiro além de Comissões e Comandas.
    await expect(nav.getByRole('button', { name: 'Eventos', exact: true })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Controle de entrada e saída', exact: true })).toHaveCount(0);
    await page.goto('/comercial');
    await expect(page).toHaveURL(/\/agenda/);
  });
});
