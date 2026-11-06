import { expect, test } from '@playwright/test';
import { openAgendaAt, pickProfessional } from '../support/agenda-ui';
import {
  createProfessional,
  createVisit,
  daysUntilNextWednesday,
  ownerToken,
  spDate,
  spInstant,
  type CreatedPro,
} from '../support/phase3';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

const SLOT_TAKEN_MESSAGE = 'Horário já reservado por outra pessoa — escolha outro slot';

test.describe('Agenda: concorrência no mesmo horário (critério #5)', () => {
  let seed: SeedState;
  let pro: CreatedPro;
  let token: string;
  const ahead = daysUntilNextWednesday();

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
    pro = await createProfessional(seed, token, 'Conc');
  });

  test('duas criações simultâneas sobrepostas: uma vence, a outra recebe SLOT_TAKEN', async () => {
    const day = spDate(ahead);
    const attempt = (from: string, to: string) =>
      createVisit(token, {
        clientId: seed.phase3.clientId,
        serviceId: seed.phase3.serviceId,
        professionalId: pro.id,
        startsAt: spInstant(day, from),
        endsAt: spInstant(day, to),
      });
    const results = await Promise.all([attempt('14:00', '15:00'), attempt('14:30', '15:30')]);

    const winners = results.filter((r) => r.errors.length === 0);
    const losers = results.filter((r) => r.errors.length > 0);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].errors[0].code).toBe('SLOT_TAKEN');
    expect(losers[0].errors[0].message).toBe(SLOT_TAKEN_MESSAGE);
  });

  test('na interface: horário tomado enquanto o formulário está aberto mostra o erro e mantém o modal', async ({
    page,
  }) => {
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await openAgendaAt(page, ahead);

    // a pessoa abre o formulário no slot livre das 16:00 ...
    await page.getByTestId(`slot-${pro.id}-16:00`).scrollIntoViewIfNeeded();
    await page.getByTestId(`slot-${pro.id}-16:00`).click();
    const form = page.getByTestId('visit-form');
    await expect(form).toBeVisible();
    await page.getByTestId('visit-client-search').fill(seed.phase3.clientName);
    await page.getByTestId(`visit-client-option-${seed.phase3.clientId}`).click();
    await page.getByTestId('visit-line-0-service').selectOption(seed.phase3.serviceId);
    await pickProfessional(page, 0, pro.id);

    // ... e, antes de salvar, outra pessoa reserva um horário sobreposto (via API)
    const taken = await createVisit(token, {
      clientId: seed.phase3.clientId,
      serviceId: seed.phase3.serviceId,
      professionalId: pro.id,
      startsAt: spInstant(spDate(ahead), '16:00'),
      endsAt: spInstant(spDate(ahead), '17:00'),
    });
    expect(taken.errors).toEqual([]);

    await page.getByTestId('visit-submit').click();
    await expect(page.getByTestId('visit-error')).toHaveText(SLOT_TAKEN_MESSAGE);
    await expect(form).toBeVisible();
  });
});
