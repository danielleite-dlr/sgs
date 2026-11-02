import { expect, type Locator, type Page } from '@playwright/test';
import { navigateViaMenu } from './ui';

/** Abre a agenda pelo menu e avança `daysAhead` dias com a seta "Próximo dia". */
export async function openAgendaAt(page: Page, daysAhead: number): Promise<void> {
  await navigateViaMenu(page, 'Agenda', 'Minha agenda');
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
