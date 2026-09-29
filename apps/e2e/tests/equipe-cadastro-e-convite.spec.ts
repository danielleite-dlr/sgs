import { expect, test } from '@playwright/test';
import { gql } from '../support/graphql';
import { waitForInvitationToken } from '../support/outbox';
import { apiLogin, readSeedState } from '../support/seed-state';
import {
  expectNoReload,
  loginViaUi,
  markNoReload,
  navigateViaMenu,
  openRowActions,
} from '../support/ui';

const PROFISSIONAIS = ['Meu Estabelecimento', 'Profissionais', 'Todos os profissionais'];
const AGENDA = ['Agenda', 'Minha agenda'];
const COMISSOES = ['Financeiro', 'Regras de comissão'];

/** Depois de criar o membro: aparece ativo, com Sênior, na agenda e no picker de comissões. */
async function expectMemberEverywhere(page: import('@playwright/test').Page, name: string) {
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row.getByText('Ativo', { exact: true })).toBeVisible();

  // Senioridade não é coluna: confere no dialog de edição.
  await openRowActions(page, new RegExp(name));
  await page.getByRole('menuitem', { name: 'Editar' }).click();
  await expect(page.getByRole('combobox', { name: 'Senioridade' })).toHaveText('Sênior');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await navigateViaMenu(page, ...AGENDA);
  await expect(page.getByRole('button', { name: `${name} — visível` })).toBeVisible();

  await navigateViaMenu(page, ...COMISSOES);
  // Com lista vazia o CTA aparece também no empty state.
  await page.getByRole('button', { name: 'Nova regra' }).first().click();
  await page.getByRole('radio', { name: /Profissional \+ Serviço/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox')
    .filter({ hasText: 'Selecione o profissional' })
    .click();
  await expect(page.getByRole('option', { name: new RegExp(name) })).toBeVisible();
  await page.keyboard.press('Escape');
}

test('cadastro direto pela UI: aparece ativo em equipe, agenda e comissões sem recarregar', async ({
  page,
}) => {
  const seed = readSeedState();
  const stamp = Date.now().toString(36);
  const name = `E2E Cadastrada ${stamp}`;
  const email = `e2e-cadastrada-${stamp}@example.com`;

  await loginViaUi(page, seed.owner.email, seed.owner.password);
  // Agenda primeiro: deixa a lista de membros em cache para pegar cache velho.
  await navigateViaMenu(page, ...AGENDA);
  await expect(page).toHaveURL(/\/agenda/);
  await markNoReload(page);

  await navigateViaMenu(page, ...PROFISSIONAIS);
  await page.getByRole('button', { name: 'Cadastrar profissional' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill(name);
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await dialog.getByLabel('Telefone').fill('11912345678');
  await dialog.getByRole('radio', { name: 'E-mail' }).click();
  await dialog.locator('#create-member-pix-value').fill(email);
  await dialog.getByRole('combobox', { name: 'Papel' }).click();
  await page.getByRole('option', { name: 'Profissional', exact: true }).click();
  await dialog.getByLabel(`E2E Cabelo ${seed.suffix}`).check();
  await dialog.getByRole('button', { name: 'Cadastrar', exact: true }).click();

  await expect(dialog.getByText('Profissional cadastrado')).toBeVisible();
  await dialog.getByRole('button', { name: 'Concluir' }).click();
  await expect(dialog).toBeHidden();

  // Senioridade Sênior (o cadastro não tem o campo).
  await openRowActions(page, new RegExp(name));
  await page.getByRole('menuitem', { name: 'Editar' }).click();
  await page.getByRole('combobox', { name: 'Senioridade' }).click();
  await page.getByRole('option', { name: 'Sênior' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await expectMemberEverywhere(page, name);
  await expectNoReload(page);
});

test('convite aceito em /convite/:token: aparece ativo, Sênior, em equipe, agenda e comissões', async ({
  page,
  browser,
}) => {
  const seed = readSeedState();
  const stamp = Date.now().toString(36);
  const name = `E2E Convidada ${stamp}`;
  const email = `e2e-convidada-${stamp}@example.com`;

  // A UI não tem mais botão de convite (substituído pelo cadastro direto):
  // o convite é disparado pela API e o aceite acontece pela UI.
  const ownerToken = await apiLogin(seed.owner.email, seed.owner.password);
  const ctx = { token: ownerToken, orgId: seed.orgId };
  const invited = await gql<{
    inviteMember: { invitationId: string | null; errors: { message: string }[] };
  }>(
    `mutation($input: InviteMemberInput!) {
      inviteMember(input: $input) { invitationId errors { code message } }
    }`,
    {
      input: {
        email,
        roleName: 'PROFESSIONAL',
        isProfessional: true,
        seniorityTier: 'senior',
      },
    },
    ctx,
  );
  expect(invited.inviteMember.errors).toEqual([]);

  const token = await waitForInvitationToken(email);

  const guest = await browser.newContext({
    baseURL: 'http://localhost:5180',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  try {
    const guestPage = await guest.newPage();
    await guestPage.goto(`/convite/${encodeURIComponent(token)}`);
    await guestPage.locator('#fullName').fill(name);
    await guestPage.locator('#password').fill('ConviteSenha#2026');
    await guestPage.locator('#password').blur();
    await guestPage.locator('form button[type="submit"]').click();
    await guestPage.waitForURL((url) => !url.pathname.startsWith('/convite'));
  } finally {
    await guest.close();
  }

  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await navigateViaMenu(page, ...PROFISSIONAIS);
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
  await markNoReload(page);
  await expectMemberEverywhere(page, name);
  await expectNoReload(page);

  const { allMembers } = await gql<{
    allMembers: {
      displayName: string;
      seniorityTier: string | null;
      status: string;
      isProfessional: boolean;
    }[];
  }>(
    `query { allMembers { displayName seniorityTier status isProfessional } }`,
    {},
    ctx,
  );
  const member = allMembers.find((m) => m.displayName === name);
  expect(member).toMatchObject({
    seniorityTier: 'senior',
    status: 'active',
    isProfessional: true,
  });
});
