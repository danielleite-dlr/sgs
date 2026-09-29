import { expect, test } from '@playwright/test';
import { gql } from '../support/graphql';
import { apiLogin, readSeedState } from '../support/seed-state';
import {
  expectNoReload,
  loginViaUi,
  markNoReload,
  navigateViaMenu,
  openRowActions,
} from '../support/ui';

test.beforeEach(async () => {
  // O banco é persistente e os testes mutam o membro: volta ao estado inicial
  // (profissional Júnior, ativo) para que --repeat-each exercite a mudança de verdade.
  const seed = readSeedState();
  const token = await apiLogin(seed.owner.email, seed.owner.password);
  const ctx = { token, orgId: seed.orgId };
  const id = seed.proEditable.memberId;
  await gql(
    `mutation($id: UUID!) { reactivateMember(id: $id) { errors { code message } } }`,
    { id },
    ctx,
  );
  await gql(
    `mutation($input: UpdateMemberInput!) {
      updateMember(input: $input) { errors { code message } }
    }`,
    {
      input: {
        id,
        roleName: 'PROFESSIONAL',
        isProfessional: true,
        seniorityTier: 'junior',
      },
    },
    ctx,
  );
});

test('editar papel/senioridade e desativar/reativar atualiza a linha sem recarregar', async ({
  page,
}) => {
  const seed = readSeedState();
  const name = new RegExp(seed.proEditable.name);
  const row = () => page.getByRole('row', { name });

  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await navigateViaMenu(
    page,
    'Meu Estabelecimento',
    'Profissionais',
    'Todos os profissionais',
  );
  await expect(row()).toBeVisible();
  await expect(row().getByRole('cell', { name: 'Profissional', exact: true })).toBeVisible();
  await markNoReload(page);

  // Editar: papel Atendente (mantém "É profissional"), senioridade Pleno.
  await openRowActions(page, name);
  await page.getByRole('menuitem', { name: 'Editar' }).click();
  const edit = page.getByRole('dialog');
  await edit.getByRole('combobox', { name: 'Papel' }).click();
  await page.getByRole('option', { name: 'Atendente' }).click();
  await edit.getByLabel('É profissional').check();
  await edit.getByRole('combobox', { name: 'Senioridade' }).click();
  await page.getByRole('option', { name: 'Pleno' }).click();
  await edit.getByRole('button', { name: 'Salvar' }).click();
  await expect(edit).toBeHidden();

  await expect(row().getByRole('cell', { name: 'Atendente', exact: true })).toBeVisible();
  await openRowActions(page, name);
  await page.getByRole('menuitem', { name: 'Editar' }).click();
  await expect(page.getByRole('combobox', { name: 'Senioridade' })).toHaveText('Pleno');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  // Desativar (sem agendamento: desativa de fato).
  await openRowActions(page, name);
  await page.getByRole('menuitem', { name: 'Desativar' }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: 'Desativar', exact: true }).click();
  await expect(row().getByText('Inativo', { exact: true })).toBeVisible();

  // Reativar.
  await openRowActions(page, name);
  await expect(page.getByRole('menuitem', { name: 'Desativar' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Reativar' }).click();
  await expect(row().getByText('Ativo', { exact: true })).toBeVisible();

  await expectNoReload(page);
});
