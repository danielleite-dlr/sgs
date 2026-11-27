import { expect, test } from '@playwright/test';
import { brl, createProfessional, ownerToken, spInstant, type CreatedPro } from '../support/phase3';
import { createBridalPackage, firstWednesdayFromNow, setStudioSettings } from '../support/phase4';
import {
  closeBrideEventComanda,
  comandaTotal,
  createStudioBrideGroup,
  scheduleBrideEvent,
} from '../support/phase91';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu, openRowActions } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

test.describe.configure({ mode: 'serial' });

test.describe('Assistente da noiva (09.1)', () => {
  let seed: SeedState;
  let token: string;
  let assistant: CreatedPro;
  let servicePro: CreatedPro;
  let pkg: { id: string; name: string };
  let groupId = '';
  let comandaId = '';
  let unique = '';
  let brideName = '';
  let groupName = '';
  const eventDate = firstWednesdayFromNow(40);

  test.beforeAll(async () => {
    // único por execução (--repeat-each recria a massa a cada rodada)
    unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    brideName = `Noiva Assistente ${unique}`;
    groupName = `Casamento ${brideName}`;
    seed = readSeedState();
    token = await ownerToken(seed);
    assistant = await createProfessional(seed, token, `Assist${unique}`);
    servicePro = await createProfessional(seed, token, `Servico${unique}`);
    pkg = await createBridalPackage(seed, token, {
      price: '3000.00',
      depositPercent: '30',
      name: `Pacote Assistente ${unique}`,
    });
    await setStudioSettings(token);
  });

  test('1. owner marca a profissional como Assistente da Noiva', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Meu Estabelecimento', 'Profissionais', 'Todos os profissionais');
    const name = new RegExp(assistant.name);
    const row = page.getByRole('row', { name });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('badge-bridal-assistant')).toHaveCount(0);

    await openRowActions(page, name);
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByTestId('member-bridal-assistant').check();
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog).toBeHidden();

    await expect(row.getByTestId('badge-bridal-assistant')).toBeVisible();
  });

  test('2. owner marca o pacote com assistente e confere diária e selo', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto('/catalogo/pacotes');
    const pkgName = new RegExp(pkg.name);
    const row = page.getByRole('row', { name: pkgName });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('pkg-badge-bridal-assistant')).toHaveCount(0);

    await openRowActions(page, pkgName);
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Editar pacote' })).toBeVisible();
    const box = dialog.getByTestId('pkg-bridal-assistant');
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(dialog.getByTestId('pkg-bridal-assistant-cost')).toContainText('R$ 220,00');
    await dialog.getByRole('button', { name: /salvar/i }).click();
    await expect(dialog).toBeHidden();

    await expect(row.getByTestId('pkg-badge-bridal-assistant')).toBeVisible();
    // A diária saiu do topo da página e fica no lápis dentro de Serviços (quick 261126-w00).
    await expect(page.getByTestId('bridal-assistant-rate-card')).toHaveCount(0);
  });

  test('3. a atendente vincula a assistente e não vê a diária', async ({ page }) => {
    const created = await createStudioBrideGroup(seed, token, {
      packageId: pkg.id,
      eventDate,
      brideName,
    });
    groupId = created.groupId;
    await scheduleBrideEvent(
      token,
      groupId,
      servicePro.id,
      seed.phase3.serviceId,
      spInstant(eventDate, '10:00'),
    );

    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await page.goto('/noivas');
    await page.getByTestId('grp-no-assistant').check();
    const row = page.getByTestId(`group-row-${groupId}`);
    await expect(row).toBeVisible();
    await expect(page.getByTestId(`badge-no-assistant-${groupId}`)).toBeVisible();

    await page.goto(`/noivas/${groupId}`);
    await expect(page.getByTestId('assistant-pending')).toContainText('Sem assistente — escolher');
    await page.getByTestId('assistant-choose').click();
    const candidate = page.getByTestId(`candidate-${assistant.id}`);
    await expect(candidate).toBeEnabled();
    await candidate.click();
    await page.getByTestId('assistant-confirm').click();

    await expect(page.getByTestId('assistant-name')).toHaveText(`Assistente: ${assistant.name}`);
    await expect(page.getByTestId('assistant-pending')).toHaveCount(0);
    await expect(page.getByTestId('assistant-rate')).toHaveCount(0);
    await expect(page.getByTestId('assistant-rate')).not.toBeVisible();

    // ao recarregar, a pendência não volta e a lista não mostra mais o selo
    await page.goto('/noivas');
    await page.getByTestId('grp-no-assistant').check();
    await expect(page.getByTestId(`badge-no-assistant-${groupId}`)).toHaveCount(0);
  });

  test('4. owner vê a diária no grupo e o bloqueio na agenda da assistente', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/noivas/${groupId}`);
    await expect(page.getByTestId('assistant-name')).toHaveText(`Assistente: ${assistant.name}`);
    await expect(page.getByTestId('assistant-rate')).toContainText('220,00');

    await page.goto(`/agenda?data=${eventDate}`);
    await expect(page.getByTestId('view-day')).toBeVisible();
    const block = page.locator('[data-testid^="time-block-"]', {
      hasText: `Acompanhando noiva ${brideName}`,
    });
    await expect(block.first()).toBeVisible();
    await expect(block.first()).toContainText(brideName);
  });

  test('5. fechar a comanda da noiva gera o repasse da diária em Comissões', async ({ page }) => {
    comandaId = await closeBrideEventComanda(token, groupId);
    // a diária não entra no total da comanda: é a soma dos serviços do pacote
    const total = await comandaTotal(token, comandaId);
    expect(Number(total)).toBeGreaterThan(0);
    expect(Number(total)).not.toBe(Number(seed.phase3.servicePrice) + 220);

    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Financeiro', 'Comissões calculadas');
    await page.getByTestId('commission-member-select').click();
    await page.getByRole('option', { name: assistant.name }).click();

    const records = page.getByTestId('commission-records');
    const line = records.locator('tr', { hasText: `Assistente da Noiva — ${groupName}` });
    await expect(line).toBeVisible();
    await expect(line).toContainText(brl('220.00'));
  });
});
