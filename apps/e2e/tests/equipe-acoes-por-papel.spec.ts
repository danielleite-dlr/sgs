import { expect, test, type Page } from '@playwright/test';
import { gql } from '../support/graphql';
import { apiLogin, readSeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

// Item 4 da VERIFICACAO da fase 02.1 descrevia "as ações aparecem e o backend
// devolve FORBIDDEN". A quick 260929-dek resolveu isso: member.invite = ADMIN +
// MANAGER (vê "Cadastrar profissional"); editRole/remove = ADMIN (só ele vê
// Ações). É esse comportamento entregue que estes testes travam.

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
  await expect(page.getByRole('button', { name: 'Ações' })).toHaveCount(0);
  for (const text of ACTION_TEXTS) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  }
}

test('MANAGER vê Cadastrar profissional mas nenhuma ação de gestão', async ({ page }) => {
  const seed = readSeedState();
  await openTeamPage(page, seed.manager.email, seed.manager.password, seed.proEditable.name);

  await expect(page.getByRole('button', { name: 'Cadastrar profissional' })).toBeVisible();
  await expectNoMemberActions(page);

  // O backend também nega: o membro segue ativo.
  const token = await apiLogin(seed.manager.email, seed.manager.password);
  const ctx = { token, orgId: seed.orgId };
  const res = await fetch('http://localhost:3100/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Organization-Id': seed.orgId,
    },
    body: JSON.stringify({
      query: `mutation($id: UUID!) { deactivateMember(id: $id) { member { id } errors { code message } } }`,
      variables: { id: seed.proEditable.memberId },
    }),
  });
  const body = (await res.json()) as {
    data?: { deactivateMember?: { member: unknown; errors: { code: string }[] } };
    errors?: { message: string; extensions?: { code?: string } }[];
  };
  const denied =
    (body.errors?.length ?? 0) > 0 ||
    (body.data?.deactivateMember?.errors.length ?? 0) > 0;
  expect(denied, JSON.stringify(body)).toBe(true);
  expect(body.data?.deactivateMember?.member ?? null).toBeNull();

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
