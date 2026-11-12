import { expect, test } from '@playwright/test';
import { expectNoUserErrors, gql } from '../support/graphql';
import { createProfessional, createVisit, ownerToken, spInstant } from '../support/phase3';
import { firstWednesdayFromNow } from '../support/phase4';
import { readSeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu, openRowActions } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1200 } });

test.describe('Exclusão definitiva de profissional e de noiva', () => {
  test('profissional sem nada em aberto: só libera digitando o nome e some da lista', async ({
    page,
  }) => {
    const seed = readSeedState();
    const token = await ownerToken(seed);
    const pro = await createProfessional(seed, token, 'Excluir');

    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Meu Estabelecimento', 'Profissionais', 'Todos os profissionais');
    const row = page.getByRole('row', { name: new RegExp(pro.name) });
    await expect(row).toBeVisible();

    await openRowActions(page, new RegExp(pro.name));
    await page.getByRole('menuitem', { name: 'Excluir definitivamente' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Esta ação é irreversível.')).toBeVisible();
    const confirm = dialog.getByTestId('confirm-delete');
    await expect(confirm).toBeDisabled();

    await dialog.getByTestId('confirm-name-input').fill(`${pro.name} errado`);
    await expect(confirm).toBeDisabled();

    await dialog.getByTestId('confirm-name-input').fill(pro.name);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(dialog).toBeHidden();
    await expect(row).toBeHidden();

    const { allMembers } = await gql<{ allMembers: { id: string }[] }>(
      `query { allMembers { id } }`,
      {},
      { token, orgId: seed.orgId },
    );
    expect(allMembers.some((m) => m.id === pro.id)).toBe(false);
  });

  test('profissional com atendimento agendado: bloqueia com a contagem e a linha continua', async ({
    page,
  }) => {
    const seed = readSeedState();
    const token = await ownerToken(seed);
    const pro = await createProfessional(seed, token, 'Bloqueada');
    const day = firstWednesdayFromNow(25);
    const visit = await createVisit(token, {
      clientId: seed.phase3.clientId,
      serviceId: seed.phase3.serviceId,
      professionalId: pro.id,
      startsAt: spInstant(day, '10:00'),
      endsAt: spInstant(day, '11:00'),
    });
    expect(visit.errors).toEqual([]);

    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Meu Estabelecimento', 'Profissionais', 'Todos os profissionais');
    await openRowActions(page, new RegExp(pro.name));
    await page.getByRole('menuitem', { name: 'Excluir definitivamente' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByTestId('confirm-name-input').fill(pro.name);
    await dialog.getByTestId('confirm-delete').click();

    await expect(dialog.getByRole('alert')).toContainText('1 atendimento agendado');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('row', { name: new RegExp(pro.name) })).toBeVisible();
  });

  test('grupo de noiva com contrato: exclui digitando o nome e volta para a lista', async ({
    page,
  }) => {
    const seed = readSeedState();
    const token = await ownerToken(seed);
    const unique = Date.now().toString(36);
    const groupName = `Excluir Noiva ${unique}`;

    const created = await gql<{
      createBridalGroup: { group: { id: string } | null; errors: never[] };
    }>(
      `mutation($input: CreateBridalGroupInput!) {
        createBridalGroup(input: $input) { group { id } errors { code message } }
      }`,
      {
        input: {
          group: { name: groupName, eventDate: firstWednesdayFromNow(70), eventTime: '16:00' },
          bride: {
            newClient: { fullName: `Noiva Excluir ${unique}`, phone: '11987654321' },
            services: [{ serviceId: seed.phase3.serviceId }],
          },
        },
      },
      { token },
    );
    expectNoUserErrors(created.createBridalGroup, 'createBridalGroup');
    const groupId = created.createBridalGroup.group!.id;

    const contract = await gql<{
      createContract: { contract: { id: string } | null; errors: never[] };
    }>(
      `mutation($input: CreateContractInput!) {
        createContract(input: $input) { contract { id } errors { code message } }
      }`,
      { input: { groupId } },
      { token },
    );
    expectNoUserErrors(contract.createContract, 'createContract');

    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/noivas/${groupId}`);
    await page.getByTestId('delete-group-permanent').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Esta ação é irreversível.')).toBeVisible();
    await expect(dialog.getByText('As clientes continuam cadastradas.')).toBeVisible();
    const confirm = dialog.getByTestId('confirm-delete');
    await expect(confirm).toBeDisabled();
    await dialog.getByTestId('confirm-name-input').fill('outro nome');
    await expect(confirm).toBeDisabled();
    await dialog.getByTestId('confirm-name-input').fill(groupName);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL(/\/noivas$/);
    await expect(page.getByText(groupName)).toHaveCount(0);

    const { bridalGroup } = await gql<{ bridalGroup: { id: string } | null }>(
      `query($id: UUID!) { bridalGroup(id: $id) { id } }`,
      { id: groupId },
      { token },
    );
    expect(bridalGroup).toBeNull();
  });
});
