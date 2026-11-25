import { expect, test, type Page } from '@playwright/test';
import { ownerToken } from '../support/phase3';
import { createMemberWithRole, type CreatedMember } from '../support/phase10';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu, openRowActions } from '../support/ui';

test.use({ viewport: { width: 1280, height: 800 } });

const ITEM_LABEL = 'Controle de entrada e saída';

test.describe.configure({ mode: 'serial' });

test.describe('Perfis de acesso', () => {
  let seed: SeedState;
  let gerente: CreatedMember;

  test.beforeAll(async () => {
    seed = readSeedState();
    const owner = await ownerToken(seed);
    gerente = await createMemberWithRole(seed, owner, 'MANAGER', 'Perfis');
  });

  async function abrirPerfis(page: Page): Promise<void> {
    await navigateViaMenu(page, 'Meu Estabelecimento', 'Profissionais', 'Perfis de acesso');
    await page.getByRole('searchbox', { name: 'Buscar pessoa' }).fill(gerente.name);
    await page.getByRole('button', { name: new RegExp(gerente.name) }).click();
    await expect(page.getByTestId('member-access-panel')).toBeVisible();
  }

  /** Força a releitura do acesso trocando de tela (a leitura por rota tem trava de 10 s). */
  async function trocarDeTelaAte(page: Page, assertion: () => Promise<void>): Promise<void> {
    await expect(async () => {
      await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Agenda', exact: true }).click();
      await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início', exact: true }).click();
      await assertion();
    }).toPass({ timeout: 40_000, intervals: [2_000, 5_000, 10_000] });
  }

  test('Admin desliga o item; o Gerente perde o menu e /financeiro cai na tela inicial', async ({
    page,
    browser,
  }) => {
    // Gerente já logado em outro contexto, vendo o item.
    const ctxG = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageG = await ctxG.newPage();
    await loginViaUi(pageG, gerente.email, gerente.password);
    const navG = pageG.getByRole('navigation', { name: 'Navegação principal' });
    await expect(navG).toBeVisible();
    await navG.getByRole('button', { name: 'Financeiro', exact: true }).click();
    await expect(navG.getByRole('link', { name: ITEM_LABEL, exact: true })).toBeVisible();

    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await abrirPerfis(page);
    const sw = page.getByTestId('access-panel-loading').or(page.getByRole('switch', { name: ITEM_LABEL, exact: true }));
    await expect(sw.first()).toBeVisible();
    const toggle = page.getByRole('switch', { name: ITEM_LABEL, exact: true });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(page.getByRole('status').filter({ hasText: 'Acesso atualizado.' })).toBeAttached();

    // O item some do menu do Gerente ao trocar de tela, sem sair da sessão.
    await trocarDeTelaAte(pageG, async () => {
      await expect(navG.getByRole('link', { name: ITEM_LABEL, exact: true })).toHaveCount(0, {
        timeout: 1_000,
      });
    });

    await pageG.goto('/financeiro');
    await expect(pageG).not.toHaveURL(/\/login/);
    await expect(pageG).not.toHaveURL(/\/financeiro/);
    await expect(pageG).toHaveURL(/dashboard/);
    // Sessão mantida: o nome da pessoa segue no rodapé do menu.
    await expect(pageG.getByText(gerente.name).first()).toBeVisible();
    await ctxG.close();
  });

  test('Voltar ao padrão do papel devolve o item ao Gerente', async ({ page, browser }) => {
    const ctxG = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageG = await ctxG.newPage();
    await loginViaUi(pageG, gerente.email, gerente.password);
    const navG = pageG.getByRole('navigation', { name: 'Navegação principal' });
    await expect(navG).toBeVisible();
    await expect(navG.getByRole('button', { name: 'Financeiro', exact: true })).toBeVisible();

    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await abrirPerfis(page);
    await expect(page.getByRole('switch', { name: ITEM_LABEL, exact: true })).not.toBeChecked();
    await page.getByRole('button', { name: 'Voltar ao padrão do papel' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Voltar ao padrão', exact: true }).click();
    await expect(page.getByRole('switch', { name: ITEM_LABEL, exact: true })).toBeChecked();
    await expect(page.getByTestId('access-reset')).toBeDisabled();

    await trocarDeTelaAte(pageG, async () => {
      const group = navG.getByRole('button', { name: 'Financeiro', exact: true });
      if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click();
      await expect(navG.getByRole('link', { name: ITEM_LABEL, exact: true })).toBeVisible({
        timeout: 1_000,
      });
    });
    await ctxG.close();
  });

  test('atalho Acessos no editar profissional abre o mesmo painel', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Meu Estabelecimento', 'Profissionais', 'Todos os profissionais');
    const name = new RegExp(gerente.name);
    await expect(page.getByRole('row', { name })).toBeVisible();
    await openRowActions(page, name);
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const edit = page.getByRole('dialog');
    await edit.getByRole('button', { name: 'Acessos', exact: true }).click();
    const sheet = page.getByRole('dialog').filter({ hasText: `Acessos de ${gerente.name}` });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('member-access-panel')).toBeVisible();
    await expect(sheet.getByRole('switch', { name: ITEM_LABEL, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('o Gerente vê o Administrador com todos os switches travados', async ({ page }) => {
    await loginViaUi(page, gerente.email, gerente.password);
    await navigateViaMenu(page, 'Meu Estabelecimento', 'Profissionais', 'Perfis de acesso');
    await page.getByRole('searchbox', { name: 'Buscar pessoa' }).fill(seed.owner.name);
    await page.getByRole('button', { name: new RegExp(seed.owner.name) }).first().click();
    const panel = page.getByTestId('member-access-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('access-person-lock')).toHaveText('O Administrador sempre tem todos os acessos.');
    const switches = panel.getByRole('switch');
    expect(await switches.count()).toBeGreaterThan(0);
    for (const sw of await switches.all()) await expect(sw).toBeDisabled();
  });
});
