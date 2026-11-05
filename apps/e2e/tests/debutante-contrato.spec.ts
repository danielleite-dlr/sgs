import { expect, test } from '@playwright/test';
import { createProfessional, ownerToken } from '../support/phase3';
import {
  createBridalPackage,
  extractAcceptLink,
  firstWednesdayFromNow,
  groupClientIds,
  LETTERHEAD_PNG,
  readDownload,
  setStudioSettings,
  updateClientContractData,
  uploadLetterhead,
} from '../support/phase4';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

// CPFs válidos distintos dos usados no fluxo da noiva.
const RESPONSIBLE_CPF = '11144477735';
const DEBUTANTE_CPF = '16899535009';

test.describe.configure({ mode: 'serial' });

test.describe('Fase 4.1: debutante com responsável -> contrato à vista -> aceite pela responsável -> PDF', () => {
  let seed: SeedState;
  let token: string;
  let pkg: { id: string; name: string };
  const unique = Date.now().toString(36);
  const eventDate = firstWednesdayFromNow(45);
  const groupName = `Debutante E2E ${unique}`;
  const debutanteName = `Debutante ${unique}`;
  const responsibleName = `Mae da Debutante ${unique}`;
  let groupId = '';
  let contractId = '';
  let acceptUrl = '';

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
    await createProfessional(seed, token, 'Debutantes');
    pkg = await createBridalPackage(seed, token, {
      price: '3000.00',
      depositPercent: '30',
      name: `SPA DOS 15 ${unique}`,
      contractDescription: 'Dia de beleza com maquiagem, penteado e spa para a debutante.',
    });
    await setStudioSettings(token);
    await uploadLetterhead(token, LETTERHEAD_PNG);
  });

  test('grupo de debutante com responsável e contrato à vista', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await navigateViaMenu(page, 'Eventos', 'Grupos de Noivas');
    await page.getByTestId('new-group').click();
    await page.getByTestId('bg-kind-debutante').check();
    await page.getByTestId('bg-name').fill(groupName);
    await page.getByTestId('bg-date').fill(eventDate);
    await page.getByTestId('group-event-time').fill('20:00');
    await page.getByTestId('responsible-name').fill(responsibleName);
    await page.getByTestId('responsible-phone').fill('11987654321');
    await page.getByTestId('bride-name').fill(debutanteName);
    await page.getByTestId('bride-add-service').selectOption(seed.phase3.serviceId);
    await page.getByTestId('bg-submit').click();
    await page.waitForURL(/\/noivas\/[0-9a-f-]{36}$/);
    groupId = page.url().split('/').pop()!;
    await expect(page.getByTestId('bg-detail-responsible')).toContainText(responsibleName);

    // ficha da responsável (contratante) e da debutante completas
    const ids = await groupClientIds(token, groupId);
    expect(ids.responsibleClientId).toBeTruthy();
    await updateClientContractData(token, ids.responsibleClientId!, {
      cpf: RESPONSIBLE_CPF,
      rg: '23.456.789-0',
      postalCode: '06083290',
      address: 'Rua das Acacias, 20 - Osasco/SP',
      phone: '11987654321',
      phone2: '11911112222',
    });
    await updateClientContractData(token, ids.brideClientId, {
      cpf: DEBUTANTE_CPF,
      address: 'Rua das Acacias, 20 - Osasco/SP',
      phone: '11955554444',
    });

    // contrato à vista
    await page.reload();
    await page.getByTestId('create-contract').click();
    await expect(page.getByRole('heading', { name: 'Novo contrato' })).toBeVisible();
    await page.locator('#contract-package').selectOption(pkg.id);
    await page.locator('#contract-mode-a_vista').click();
    await expect(page.getByTestId('contract-form-total')).toHaveText('R$ 3.000,00');
    await expect(page.getByTestId('contract-summary')).not.toContainText('Restante');
    await page.getByTestId('contract-submit').click();
    await page.waitForURL(/\/contratos\/[0-9a-f-]{36}$/);
    contractId = page.url().split('/').pop()!;
    await expect(page.getByTestId('contract-installments')).toContainText('À vista');
    await expect(page.getByTestId('contract-installments')).toContainText('À VISTA');
    await expect(page.getByTestId('contract-installments')).not.toContainText('RESTANTE');

    await expect(page.getByTestId('contract-missing')).toHaveCount(0);
    await page.getByTestId('contract-generate-link').click();
    acceptUrl = await extractAcceptLink(page);
    expect(acceptUrl).toContain(`/aceite/${seed.orgId}/`);
  });

  test('aceite com o CPF da debutante é recusado; com o da responsável é aceito; PDF DEBUTANTE_', async ({ browser }) => {
    expect(contractId).not.toBe('');
    const context = await browser.newContext({ locale: 'pt-BR' });
    const pub = await context.newPage();
    try {
      await pub.goto(acceptUrl);
      const text = pub.getByLabel('Texto do contrato');
      await expect(text).toContainText('Debutante:');
      await expect(text).toContainText(debutanteName);
      await expect(text).toContainText('À VISTA');
      await expect(text).not.toContainText('RESTANTE PAGAMENTO');

      await pub.locator('#accept-name').fill(responsibleName);
      await pub.locator('#accept-cpf').fill(DEBUTANTE_CPF);
      await pub.locator('#accept-terms').check();
      await pub.getByRole('button', { name: 'Aceito' }).click();
      await expect(pub.getByText(/não confere/i)).toBeVisible();

      await pub.locator('#accept-cpf').fill(RESPONSIBLE_CPF);
      await pub.getByRole('button', { name: 'Aceito' }).click();
      await expect(pub.getByText(/^Contrato aceito em/)).toBeVisible();

      const [download] = await Promise.all([
        pub.waitForEvent('download'),
        pub.getByRole('link', { name: 'Baixar PDF' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^DEBUTANTE_.+\.pdf$/);
      expect((await readDownload(download)).subarray(0, 4).toString('latin1')).toBe('%PDF');
    } finally {
      await context.close();
    }
  });
});
