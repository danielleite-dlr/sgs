import { expect, test } from '@playwright/test';
import { pickSearchable } from '../support/agenda-ui';
import { createClient, createProfessional, ownerToken, type CreatedPro } from '../support/phase3';
import { createBridalPackage, firstWednesdayFromNow, setStudioSettings } from '../support/phase4';
import { createAssistantMember, createStudioDebutanteGroup } from '../support/phase11';
import { setPackageIncludesAssistant } from '../support/phase91';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

/**
 * G-01: Assistente é um papel (sem e-mail/senha), não aparece no Novo agendamento
 * e acompanha debutante no estúdio quando o pacote inclui assistente.
 */
test.describe('Papel Assistente (fase 11, G-01)', () => {
  let seed: SeedState;
  let token: string;
  let unique = '';
  let assistant: { id: string; name: string };
  let otherPro: CreatedPro;
  let pkg: { id: string; name: string };
  const agendaDay = firstWednesdayFromNow(75);
  const eventDate = firstWednesdayFromNow(82);

  test.beforeAll(async () => {
    unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    seed = readSeedState();
    token = await ownerToken(seed);
    assistant = await createAssistantMember(token, `Assistente E2E ${unique}`);
    otherPro = await createProfessional(seed, token, 'AssistOutra');
    pkg = await createBridalPackage(seed, token, {
      price: '3000.00',
      depositPercent: '30',
      name: `Pacote Debutante Assist ${unique}`,
    });
    await setPackageIncludesAssistant(token, pkg.id, true);
    await setStudioSettings(token);
  });

  test('1. dona cadastra uma Assistente sem e-mail e sem senha', async ({ page }) => {
    const name = `Assist UI ${unique}`;
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Meu Estabelecimento', 'Profissionais', 'Todos os profissionais');
    await page.getByRole('button', { name: 'Cadastrar profissional' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome', { exact: true }).fill(name);
    await dialog.getByLabel('Telefone').fill('11955554444');
    await dialog.getByRole('radio', { name: 'Celular' }).click();
    await dialog.locator('#create-member-pix-value').fill('11955554444');
    await dialog.getByRole('combobox', { name: 'Papel' }).click();
    await page.getByRole('option', { name: 'Assistente', exact: true }).click();

    await expect(dialog.getByTestId('assistant-role-hint')).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'E-mail' })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await expect(dialog.getByText('foi cadastrada como Assistente')).toBeVisible();
    await expect(dialog.getByLabel('Senha')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Concluir' }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row.getByText('Assistente', { exact: true }).first()).toBeVisible();
    await expect(row.getByText('Assistente da Noiva', { exact: true })).toBeVisible();
  });

  test('2. Novo agendamento não oferece a Assistente; a coluna existe na Agenda', async ({
    page,
  }) => {
    const client = await createClient(token, 'AssistPapel');
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/agenda?data=${agendaDay}&visao=day`);
    await expect(page.getByTestId('view-day')).toBeVisible();

    // a coluna da Assistente existe (filtros começam recolhidos)
    await page.getByRole('button', { name: 'Mostrar filtros' }).click();
    await expect(page.getByRole('button', { name: `${assistant.name} — visível` })).toBeVisible();
    await page.getByRole('button', { name: 'Ocultar filtros' }).click();

    await page.getByRole('button', { name: 'Agendar', exact: true }).click();
    await expect(page.getByTestId('visit-form')).toBeVisible();
    await page.getByTestId('visit-client-search').fill(client.name);
    await page.getByTestId(`visit-client-option-${client.id}`).click();
    await pickSearchable(page, 'visit-line-0-service', seed.phase3.serviceId);
    await page.getByTestId('visit-line-0-time').fill('11:00');

    // a outra profissional aparece (select ou controle segmentado); a Assistente nunca
    const select = page.getByTestId('visit-line-0-professional');
    await expect(async () => {
      await expect(
        page.locator(
          `[data-testid="visit-line-0-professional"] option[value="${otherPro.id}"], [data-testid="visit-line-0-professional-${otherPro.id}"]`,
        ),
      ).toHaveCount(1);
    }).toPass({ timeout: 15_000 });
    await expect(select.locator(`option[value="${assistant.id}"]`)).toHaveCount(0);
    await expect(page.getByTestId(`visit-line-0-professional-${assistant.id}`)).toHaveCount(0);
    await expect(page.getByTestId('visit-form')).not.toContainText(assistant.name);
  });

  test("3. debutante no estúdio com pacote 'inclui assistente' recebe a Assistente", async ({
    page,
  }) => {
    const created = await createStudioDebutanteGroup(seed, token, {
      packageId: pkg.id,
      eventDate,
      unique,
    });

    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/noivas/${created.groupId}`);
    const card = page.getByTestId('assistant-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Assistente da debutante' })).toBeVisible();
    await page.getByTestId('assistant-choose').click();
    const candidate = page.getByTestId(`candidate-${assistant.id}`);
    await expect(candidate).toBeEnabled();
    await candidate.click();
    await page.getByTestId('assistant-confirm').click();
    await expect(page.getByTestId('assistant-name')).toHaveText(`Assistente: ${assistant.name}`);

    await page.goto(`/agenda?data=${eventDate}&visao=day`);
    await expect(page.getByTestId('view-day')).toBeVisible();
    const block = page.locator('[data-testid^="time-block-"]', {
      hasText: `Acompanhando debutante ${created.debutanteName}`,
    });
    await expect(block.first()).toBeVisible();
  });
});
