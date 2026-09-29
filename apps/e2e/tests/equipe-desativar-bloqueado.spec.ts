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

// Mesmas options do formatStartsAt do DeactivateMemberDialog; o fuso fixa o do
// browser configurado no playwright.config (America/Sao_Paulo).
function formatStartsAt(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

test('desativar profissional com agendamento futuro fica bloqueado e o membro segue ativo', async ({
  page,
}) => {
  const seed = readSeedState();
  const name = seed.proBlocked.name;
  const { clientName, serviceName, startsAt } = seed.appointment;

  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await navigateViaMenu(
    page,
    'Meu Estabelecimento',
    'Profissionais',
    'Todos os profissionais',
  );
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
  await markNoReload(page);

  await openRowActions(page, new RegExp(name));
  await page.getByRole('menuitem', { name: 'Desativar' }).click();

  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByText(`Desativar ${name}?`)).toBeVisible();
  await confirm.getByRole('button', { name: 'Desativar', exact: true }).click();

  const blocked = page.getByRole('alertdialog');
  await expect(
    blocked.getByText(`Não é possível desativar ${name} agora`),
  ).toBeVisible();
  await expect(blocked.getByText(/1 agendamento\(s\) futuro\(s\)/)).toBeVisible();
  await expect(blocked.getByText('Próximos agendamentos')).toBeVisible();
  await expect(
    blocked.getByRole('listitem').filter({
      hasText: `${clientName} — ${serviceName} — ${formatStartsAt(startsAt)}`,
    }),
  ).toBeVisible();

  await blocked.getByRole('button', { name: 'Entendi' }).click();
  await expect(blocked).toBeHidden();
  await expect(
    page.getByRole('row', { name: new RegExp(name) }).getByText('Ativo', { exact: true }),
  ).toBeVisible();

  const token = await apiLogin(seed.owner.email, seed.owner.password);
  const { allMembers } = await gql<{
    allMembers: { displayName: string; status: string }[];
  }>(`query { allMembers { displayName status } }`, {}, {
    token,
    orgId: seed.orgId,
  });
  expect(allMembers.find((m) => m.displayName === name)?.status).toBe('active');
  await expectNoReload(page);
});
