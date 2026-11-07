import { expect, type Locator, type Page } from '@playwright/test';
import { navigateViaMenu } from './ui';

/** Abre a agenda pelo menu e avança `daysAhead` dias com a seta "Próximo dia". */
export async function openAgendaAt(page: Page, daysAhead: number): Promise<void> {
  await navigateViaMenu(page, 'Agenda');
  await expect(page.getByTestId('view-day')).toBeVisible();
  const next = page.getByRole('button', { name: 'Próximo dia' });
  for (let i = 0; i < daysAhead; i += 1) await next.click();
}

/**
 * Arrasta um card `slots` meias-horas para baixo (negativo = para cima) com o
 * mouse real em passos: `dragTo()` não aciona o PointerSensor do dnd-kit.
 */
export async function dragCardBySlots(
  page: Page,
  card: Locator,
  slotHeight: number,
  slots: number,
): Promise<void> {
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error('card sem boundingBox');
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 16);
  await page.mouse.move(x, y);
  await page.mouse.down();
  // passo inicial curto: ultrapassa a distância de ativação (6px) do sensor
  await page.mouse.move(x, y + 10, { steps: 3 });
  await page.mouse.move(x, y + slots * slotHeight, { steps: 10 });
  await page.mouse.up();
}

export async function slotHeightOf(page: Page, professionalId: string): Promise<number> {
  const slot = page.getByTestId(`slot-${professionalId}-10:00`);
  await slot.scrollIntoViewIfNeeded();
  const box = await slot.boundingBox();
  if (!box) throw new Error('slot sem boundingBox');
  return box.height;
}

/**
 * Escolhe o profissional da linha `line` do formulário de agendamento: com até 4 opções o
 * formulário mostra um controle segmentado (radiogroup), acima disso um select (06-04, D-20).
 * A lista muda quando a consulta de profissionais do serviço volta, então tenta de novo até
 * a escolha ficar marcada.
 */
export async function pickProfessional(
  page: Page,
  line: number,
  professionalId: string,
): Promise<void> {
  const el = page.getByTestId(`visit-line-${line}-professional`);
  await expect(async () => {
    if (await el.evaluate((n) => n.tagName === 'SELECT')) {
      await el.selectOption(professionalId, { timeout: 2000 });
      await expect(el).toHaveValue(professionalId, { timeout: 1000 });
    } else {
      const opt = page.getByTestId(`visit-line-${line}-professional-${professionalId}`);
      await opt.click({ timeout: 2000 });
      await expect(opt).toHaveAttribute('aria-checked', 'true', { timeout: 1000 });
    }
  }).toPass({ timeout: 15_000 });
}

/** Abre a seção "Sinal" do formulário de agendamento (começa recolhida, D-20). */
export async function openDeposit(page: Page): Promise<void> {
  const t = page.getByTestId('visit-deposit-toggle');
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
  await expect(page.getByTestId('visit-deposit-amount')).toBeVisible();
}
