import { expect, test, type Locator } from '@playwright/test';
import { openAgendaAt } from '../support/agenda-ui';
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

// quick-261108-n4s: cada profissional tem uma cor na agenda (fundo do cartão e bolinha do
// cabeçalho); a borda esquerda continua sendo a cor do status. Adendo: nome completo visível.
test.use({ viewport: { width: 1600, height: 1200 } });

const BRANCO = 'rgb(255, 255, 255)';
const PRIMARY_50 = 'rgb(245, 230, 251)';

// Cópia de apps/frontend/src/lib/format-name.ts (o E2E não importa do frontend).
const PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
function displayName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      const lower = word.toLocaleLowerCase('pt-BR');
      if (i > 0 && PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
    })
    .join(' ');
}

async function cores(el: Locator) {
  return el.evaluate((node) => {
    const s = getComputedStyle(node);
    return { bg: s.backgroundColor, borda: s.borderLeftColor };
  });
}

test.describe('Agenda: cor e nome completo por profissional', () => {
  let seed: SeedState;
  let pros: CreatedPro[];
  let visitIds: string[];
  const ahead = daysUntilNextWednesday();

  test.beforeAll(async () => {
    seed = readSeedState();
    const token = await ownerToken(seed);
    // Criadas em sequência: ids v7 vizinhos, logo tons vizinhos da paleta (nunca iguais).
    const a = await createProfessional(seed, token, 'CorA');
    const b = await createProfessional(seed, token, 'CorB');
    pros = [a, b];
    const day = spDate(ahead);
    visitIds = [];
    for (const pro of pros) {
      const visit = await createVisit(token, {
        clientId: seed.phase3.clientId,
        serviceId: seed.phase3.serviceId,
        professionalId: pro.id,
        startsAt: spInstant(day, '10:00'),
        endsAt: spInstant(day, '11:00'),
      });
      expect(visit.errors).toEqual([]);
      visitIds.push(visit.appointments[0].id);
    }
  });

  test('fundo na cor da profissional no Dia e na Semana, borda do status', async ({ page }) => {
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await openAgendaAt(page, ahead);

    const cards = visitIds.map((id) => page.getByTestId(`appointment-card-${id}`));
    for (const card of cards) await expect(card).toBeVisible();
    const [c1, c2] = await Promise.all(cards.map(cores));
    expect(c1.bg).not.toBe(BRANCO);
    expect(c2.bg).not.toBe(BRANCO);
    expect(c1.bg).not.toBe(c2.bg);
    // Mesmo status nos dois: mesma borda, diferente do fundo.
    expect(c1.borda).toBe(c2.borda);
    expect(c1.borda).not.toBe(c1.bg);

    const avatares = pros.map((p) => page.getByTestId(`lane-avatar-${p.id}`));
    const [a1, a2] = await Promise.all(avatares.map(cores));
    expect(a1.bg).not.toBe(a2.bg);
    expect(a1.bg).not.toBe(PRIMARY_50);
    expect(a2.bg).not.toBe(PRIMARY_50);

    await page.getByTestId('view-week').click();
    for (const [i, id] of visitIds.entries()) {
      const semana = page.getByTestId(`week-card-${id}`);
      await expect(semana).toBeVisible();
      expect((await cores(semana)).bg).toBe([c1, c2][i].bg);
    }
  });

  test('nome completo da profissional no cabeçalho da coluna e no filtro lateral', async ({
    page,
  }) => {
    await loginViaUi(page, seed.attendant.email, seed.attendant.password);
    await openAgendaAt(page, ahead);

    for (const pro of pros) {
      const nome = displayName(pro.name);
      const cabecalho = page.getByTestId(`lane-avatar-${pro.id}`).locator('xpath=..');
      await expect(cabecalho.getByText(nome, { exact: true })).toBeVisible();
      const filtro = page.getByRole('button', { name: `${pro.name} — visível` });
      await expect(filtro.getByText(nome, { exact: true })).toBeVisible();
    }
  });
});
