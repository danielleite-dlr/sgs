import { expect, test } from '@playwright/test';
import { gql } from '../support/graphql';
import {
  createClient,
  createProfessional,
  createVisit,
  ownerToken,
  spDate,
  spInstant,
} from '../support/phase3';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

/** Próximo horário cheio, 1 h à frente, no fuso SP; se passar das 21h usa amanhã 10:00. */
function visitSlot(): { day: string; from: string; to: string; today: boolean } {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );
  const start = hour + 1;
  if (start >= 7 && start <= 20) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return { day: spDate(0), from: `${pad(start)}:00`, to: `${pad(start + 1)}:00`, today: true };
  }
  return { day: spDate(1), from: '10:00', to: '11:00', today: false };
}

test.describe('Início: painel operacional com dados reais', () => {
  let seed: SeedState;
  let token: string;
  let clientName: string;
  let comandaId: string;
  let comandaCode: string;
  let todayVisit = true;

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
    const pro = await createProfessional(seed, token, 'Ini');
    const client = await createClient(token, `Ini ${seed.suffix}`);
    clientName = client.name;
    const slot = visitSlot();
    todayVisit = slot.today;
    const visit = await createVisit(token, {
      clientId: client.id,
      serviceId: seed.phase3.serviceId,
      professionalId: pro.id,
      startsAt: spInstant(slot.day, slot.from),
      endsAt: spInstant(slot.day, slot.to),
    });
    expect(visit.errors).toEqual([]);
    comandaId = visit.comandaId!;
    const c = await gql<{ comanda: { code: string } }>(
      `query($id: UUID!) { comanda(id: $id) { code } }`,
      { id: comandaId },
      { token },
    );
    comandaCode = c.comanda.code;
  });

  test('dono vê os blocos do painel com dados reais', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();

    const strip = page.getByTestId('day-kpi-strip');
    await expect(strip.getByText('Atendimentos hoje')).toBeVisible();

    // total do KPI igual ao calculado pela API (sem cancelados e faltas)
    const data = await gql<{ appointments: { status: string }[] }>(
      `query($s: DateTime!, $e: DateTime!) { appointments(startsAt: $s, endsAt: $e) { status } }`,
      { s: spInstant(spDate(0), '00:00'), e: spInstant(spDate(1), '00:00') },
      { token },
    );
    const esperado = data.appointments.filter(
      (a) => a.status !== 'cancelled' && a.status !== 'no_show',
    ).length;
    await expect(page.getByTestId('kpi-appointments-total')).toHaveText(String(esperado));

    // comandas em aberto: a criada aparece e leva ao detalhe
    const comandas = page.getByTestId('open-comandas');
    const link = comandas.getByRole('link', { name: comandaCode }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/comanda/${comandaId}$`));
    await page.goBack();

    if (todayVisit) {
      await expect(page.getByTestId('upcoming-appointments')).toContainText(
        new RegExp(clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      );
    }
    await expect(page.getByTestId('forecast-card')).toBeVisible();

    // contratos: nome da primeira noiva ou texto de vazio
    const contratos = page.getByTestId('upcoming-contracts');
    await expect(contratos).toBeVisible();
    const hoje = spDate(0);
    const list = await gql<{
      contracts: { status: string; eventDate: string; brideName: string }[];
    }>(`query { contracts { status eventDate brideName } }`, {}, { token });
    const proximos = list.contracts
      .filter((c) => ['active', 'awaiting_acceptance'].includes(c.status) && c.eventDate >= hoje)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    if (proximos.length > 0) {
      await expect(contratos.getByTestId('contract-row').first()).toContainText(
        new RegExp(proximos[0].brideName.split(' ')[0], 'i'),
      );
    } else {
      await expect(contratos).toContainText('Nenhum contrato com evento próximo');
    }
  });

  test('no celular mostra Métricas do dia e botão de comandas com 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto('/dashboard');
    await expect(page.getByText('Métricas do dia', { exact: true })).toBeVisible();
    const botao = page.getByRole('link', { name: 'Ver todas as comandas' });
    await expect(botao).toBeVisible();
    const box = await botao.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
