import { expect, test } from '@playwright/test';
import { dragCardBySlots, openAgendaAt, slotHeightOf } from '../support/agenda-ui';
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
import { expectNoReload, loginViaUi, markNoReload } from '../support/ui';

// Grade alta: o destino do arrasto precisa ficar dentro da janela visível.
test.use({ viewport: { width: 1600, height: 1500 } });

test.describe('Agenda: arrastar e soltar (critério #1)', () => {
  let seed: SeedState;
  let pro: CreatedPro;
  let firstId: string;
  const ahead = daysUntilNextWednesday();

  test.beforeAll(async () => {
    seed = readSeedState();
    const token = await ownerToken(seed);
    pro = await createProfessional(seed, token, 'DnD');
    const day = spDate(ahead);
    const mk = async (from: string, to: string) => {
      const visit = await createVisit(token, {
        clientId: seed.phase3.clientId,
        serviceId: seed.phase3.serviceId,
        professionalId: pro.id,
        startsAt: spInstant(day, from),
        endsAt: spInstant(day, to),
      });
      expect(visit.errors).toEqual([]);
      return visit.appointments[0].id;
    };
    firstId = await mk('10:00', '11:00');
    await mk('14:00', '15:00');
  });

  test('arrasta 2 slots, persiste após recarregar e volta ao soltar sobre outro agendamento', async ({
    page,
  }) => {
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await openAgendaAt(page, ahead);
    await markNoReload(page);

    const card = page.getByTestId(`appointment-card-${firstId}`);
    await expect(card).toHaveAttribute('data-starts', '10:00');
    const slotHeight = await slotHeightOf(page, pro.id);

    await dragCardBySlots(page, card, slotHeight, 2);
    await expect(page.getByText('Agendamento movido.')).toBeVisible();
    await expect(card).toHaveAttribute('data-starts', '11:00');
    await expect(card).toHaveAttribute('data-ends', '12:00');
    await expectNoReload(page);

    // persistência: recarrega a página e navega até o mesmo dia
    await page.reload();
    await openAgendaAt(page, ahead);
    const reloaded = page.getByTestId(`appointment-card-${firstId}`);
    await expect(reloaded).toHaveAttribute('data-starts', '11:00');
    await expect(reloaded).toHaveAttribute('data-ends', '12:00');

    // 6 slots para baixo = 14:00, por cima do outro agendamento
    const height = await slotHeightOf(page, pro.id);
    await dragCardBySlots(page, reloaded, height, 6);
    await expect(page.getByText(/Não foi possível mover/)).toBeVisible();
    await expect(reloaded).toHaveAttribute('data-starts', '11:00');
    await expect(reloaded).toHaveAttribute('data-ends', '12:00');
  });
});
