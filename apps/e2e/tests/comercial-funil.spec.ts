import { expect, test, type Page } from '@playwright/test';
import { ownerToken } from '../support/phase3';
import { createBridalPackage, todayPlusDays } from '../support/phase4';
import {
  createCommercialDeal,
  createCommercialLead,
  loginToken,
  randomPhone,
  randomSuffix,
} from '../support/phase9';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi, navigateViaMenu } from '../support/ui';

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: 'serial' });

/** Espera as animações do diálogo terminarem antes de medir ou clicar. */
/** Arrasta com o mouse em passos (o PointerSensor do @dnd-kit exige distance: 8). */
async function dragCardToStage(page: Page, cardName: string, stageName: string): Promise<void> {
  const card = page.locator('li[data-testid^="deal-"]', { hasText: cardName });
  // o link do nome barra o arraste (stopPropagation); pega-se pelo texto do tipo do negócio
  const handle = card.locator('p').first();
  const column = page.getByRole('region', { name: stageName, exact: true });
  const from = (await handle.boundingBox())!;
  const to = (await column.boundingBox())!;
  const startX = from.x + Math.min(20, from.width / 2);
  const startY = from.y + from.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12, startY + 2, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 });
  await page.mouse.up();
}

test.describe('Fase 9: funil comercial até o contrato', () => {
  let seed: SeedState;
  let attendantToken: string;
  let pkg: { id: string; name: string };
  const unique = randomSuffix();
  const leadName = `Lead Funil ${unique}`;
  const lostLeadName = `Lead Perdido ${unique}`;
  const eventDate = todayPlusDays(120);

  test.beforeAll(async () => {
    seed = readSeedState();
    const owner = await ownerToken(seed);
    attendantToken = await loginToken(seed.attendant);
    pkg = await createBridalPackage(seed, owner, {
      price: '5000.00',
      depositPercent: '30',
      name: `Pacote Comercial ${unique}`,
    });
  });

  test('lead -> negócio -> mover -> interação -> ganho -> contrato rascunho', async ({ page }) => {
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);

    // ---- cadastrar o lead ----
    await navigateViaMenu(page, 'Comercial', 'Leads');
    await expect(page).toHaveURL(/\/comercial\/leads$/);
    await page.getByRole('button', { name: 'Novo lead' }).click();
    await page.locator('#lead-name').fill(leadName);
    await page.locator('#lead-phone').fill(randomPhone());
    await page.getByRole('button', { name: 'Salvar' }).click();
    await page.waitForURL(/\/comercial\/leads\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: leadName }).first()).toBeVisible();

    // ---- negócio Noiva com pacote e desconto ----
    await page.getByRole('button', { name: 'Novo negócio' }).click();
    await expect(page.getByRole('heading', { name: 'Novo negócio' })).toBeVisible();
    await page.getByRole('radio', { name: 'Noiva' }).check();
    await page.locator('#deal-date').fill(eventDate);
    await page.locator('#deal-package').selectOption(pkg.id);
    await page.locator('#deal-discount').fill('50');
    await expect(page.getByText('R$ 4.950,00', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Negócio criado.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Novo negócio' })).toHaveCount(0);

    // ---- interação com próximo contato (lembrete) ----
    await page.getByRole('tab', { name: 'Interações' }).click();
    await page.getByRole('button', { name: 'Registrar interação' }).click();
    await page.locator('#int-type').selectOption({ label: 'WhatsApp' });
    await page.locator('#int-next').fill(`${todayPlusDays(1)}T10:00`);
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Registrar interação' })).toHaveCount(0);

    await navigateViaMenu(page, 'Comercial', 'Lembretes');
    await page.getByRole('tab', { name: 'Próximos' }).click();
    await expect(page.getByText(`Retomar contato com ${leadName}`)).toBeVisible();

    // ---- pipeline: arrastar Novo -> Contato ----
    await navigateViaMenu(page, 'Comercial', 'Pipeline');
    const novo = page.getByRole('region', { name: 'Novo', exact: true });
    await expect(novo.getByText(leadName)).toBeVisible();
    await dragCardToStage(page, leadName, 'Contato');
    await expect(
      page.getByRole('region', { name: 'Contato', exact: true }).getByText(leadName),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('region', { name: 'Contato', exact: true }).getByText(leadName),
    ).toBeVisible();

    // ---- "Mover para…" -> Proposta ----
    const card = page.locator('li[data-testid^="deal-"]', { hasText: leadName });
    await card.getByRole('button', { name: `Ações de ${leadName}` }).click();
    await page.getByRole('menuitem', { name: 'Proposta', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Proposta', exact: true }).getByText(leadName),
    ).toBeVisible();

    // ---- ganho com sinal ----
    await card.getByRole('button', { name: `Ações de ${leadName}` }).click();
    await page.getByRole('menuitem', { name: 'Marcar como ganho' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Marcar como ganho' })).toBeVisible();
    await expect(dialog.locator('#win-cpf')).toBeVisible();
    await dialog.locator('#win-cpf').fill('52998224725');
    await dialog.locator('#win-rg').fill('123456789');
    await dialog.locator('#win-postalCode').fill('06083290');
    await dialog.locator('#win-address').fill('Rua das Flores, 10 - Osasco/SP');
    await dialog.locator('#win-phone2').fill('11987654321');
    await dialog.getByRole('radio', { name: 'Sim' }).check();
    await dialog.locator('#win-method-0').selectOption('pix');
    // sinal de 30% de R$ 4.950,00 = R$ 1.485,00
    await dialog.locator('#win-amount-0').fill('148500');
    await dialog.getByTestId('win-submit').click();

    await page.waitForURL(/\/contratos\/[0-9a-f-]{36}$/);
    await expect(page).toHaveURL(/\/contratos\/[0-9a-f-]{36}$/);
    await expect(page.getByText('Rascunho', { exact: true }).first()).toBeVisible();
  });

  test('perdido com motivo some das colunas abertas e vai para Perdido', async ({ page }) => {
    const lead = await createCommercialLead(attendantToken, { fullName: lostLeadName });
    await createCommercialDeal(attendantToken, {
      leadId: lead.id,
      kind: 'noiva',
      packageId: pkg.id,
      eventDate,
    });

    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await navigateViaMenu(page, 'Comercial', 'Pipeline');
    const card = page.locator('li[data-testid^="deal-"]', { hasText: lostLeadName });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: `Ações de ${lostLeadName}` }).click();
    await page.getByRole('menuitem', { name: 'Marcar como perdido' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Preço' }).check();
    await dialog.getByRole('button', { name: 'Marcar como perdido' }).click();

    const perdido = page.getByRole('region', { name: 'Perdido', exact: true });
    await expect(perdido.getByText(lostLeadName)).toBeVisible();
    for (const open of ['Novo', 'Contato', 'Proposta']) {
      await expect(
        page.getByRole('region', { name: open, exact: true }).getByText(lostLeadName),
      ).toHaveCount(0);
    }
  });
});
