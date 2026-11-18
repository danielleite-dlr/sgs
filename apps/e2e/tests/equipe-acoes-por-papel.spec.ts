import { expect, test, type Page } from '@playwright/test';
import { gql } from '../support/graphql';
import { apiLogin, readSeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

// Quick 261118-gpm (decisão da usuária em 18/11): o MANAGER gerencia a equipe igual ao
// ADMIN (editar, trocar papel, nova senha, desativar, reativar, excluir). ATTENDANT
// continua sem nenhuma ação de equipe.

const ACTION_TEXTS = ['Editar', 'Desativar', 'Reativar', 'Gerar nova senha provisória'];

async function openTeamPage(page: Page, email: string, password: string, seedName: string) {
  await loginViaUi(page, email, password);
  await navigateViaMenu(
    page,
    'Meu Estabelecimento',
    'Profissionais',
    'Todos os profissionais',
  );
  await expect(page.getByRole('row', { name: new RegExp(seedName) })).toBeVisible();
}

async function expectNoMemberActions(page: Page) {
  await expect(page.getByRole('columnheader', { name: 'Ações' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ações', exact: true })).toHaveCount(0);
  for (const text of ACTION_TEXTS) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  }
}

test('MANAGER vê Cadastrar profissional e as ações de gestão', async ({ page }) => {
  const seed = readSeedState();
  await openTeamPage(page, seed.manager.email, seed.manager.password, seed.proEditable.name);

  await expect(page.getByRole('button', { name: 'Cadastrar profissional' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Ações' })).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(seed.proEditable.name) });
  await row.getByRole('button', { name: 'Ações', exact: true }).click();
  for (const text of ['Editar', 'Desativar', 'Gerar nova senha provisória']) {
    await expect(page.getByRole('menuitem', { name: text })).toBeVisible();
  }
  await page.keyboard.press('Escape');

  // O backend também aceita: desativa e reativa (o membro volta a ficar ativo).
  const token = await apiLogin(seed.manager.email, seed.manager.password);
  const ctx = { token, orgId: seed.orgId };
  const off = await gql<{ deactivateMember: { member: { id: string } | null; errors: { code: string }[] } }>(
    `mutation($id: UUID!) { deactivateMember(id: $id) { member { id } errors { code } } }`,
    { id: seed.proEditable.memberId },
    ctx,
  );
  expect(off.deactivateMember.errors).toEqual([]);
  const on = await gql<{ reactivateMember: { member: { id: string } | null; errors: { code: string }[] } }>(
    `mutation($id: UUID!) { reactivateMember(id: $id) { member { id } errors { code } } }`,
    { id: seed.proEditable.memberId },
    ctx,
  );
  expect(on.reactivateMember.errors).toEqual([]);

  const { allMembers } = await gql<{ allMembers: { id: string; status: string }[] }>(
    `query { allMembers { id status } }`,
    {},
    ctx,
  );
  expect(allMembers.find((m) => m.id === seed.proEditable.memberId)?.status).toBe('active');
});

test('ATTENDANT não vê Cadastrar profissional nem nenhuma ação de equipe', async ({ page }) => {
  const seed = readSeedState();
  await openTeamPage(page, seed.attendant.email, seed.attendant.password, seed.proEditable.name);

  await expect(page.getByRole('button', { name: 'Cadastrar profissional' })).toHaveCount(0);
  await expectNoMemberActions(page);
});
