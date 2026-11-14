import { expect, test } from '@playwright/test';
import { pickProfessional } from '../support/agenda-ui';
import { gql } from '../support/graphql';
import { createProfessional, ownerToken, type CreatedPro } from '../support/phase3';
import { firstWednesdayFromNow, setStudioSettings } from '../support/phase4';
import {
  createGlamPackage,
  createGroupWithCompanion,
  ensureAttendant,
  setGlamTimeline,
  type GroupWithCompanion,
} from '../support/phase42';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

interface Appt {
  id: string;
  professionalId: string;
  clientId: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

/** Cronograma da noiva (04.2): pacote configurado, simulação, ok do studio, agenda e guarda das acompanhantes. */
test.describe('Cronograma do dia da noiva e guarda das acompanhantes', () => {
  let seed: SeedState;
  let token: string;
  let pkg: Awaited<ReturnType<typeof createGlamPackage>>;
  let makePro: CreatedPro;
  let hairPro: CreatedPro;
  let freePro: CreatedPro;
  let group: GroupWithCompanion;
  let attendant: Awaited<ReturnType<typeof ensureAttendant>>;
  const unique = Date.now().toString(36);
  const eventDate = firstWednesdayFromNow(40);

  async function groupAppointmentsOf(clientId: string): Promise<Appt[]> {
    const data = await gql<{ appointments: Appt[] }>(
      `query($s: DateTime!, $e: DateTime!) {
        appointments(startsAt: $s, endsAt: $e) { id professionalId clientId startsAt endsAt status }
      }`,
      { s: `${eventDate}T00:00:00-03:00`, e: `${eventDate}T23:59:59-03:00` },
      { token },
    );
    return data.appointments
      .filter((a) => a.clientId === clientId && a.status !== 'cancelled')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
    makePro = await createProfessional(seed, token, 'CronMake');
    hairPro = await createProfessional(seed, token, 'CronHair');
    freePro = await createProfessional(seed, token, 'CronLivre');
    pkg = await createGlamPackage(seed, token, { name: `Glam ${unique}`, price: '3000.00' });
    await setGlamTimeline(token, pkg.id, pkg.makeServiceId, pkg.hairServiceId);
    await setStudioSettings(token);
    group = await createGroupWithCompanion(seed, token, {
      packageId: pkg.id,
      eventDate,
      readyBy: '17:00',
      unique,
    });
    attendant = await ensureAttendant(seed, token);
  });

  test('pacote, simulação, cópia, ok do studio e cronograma na agenda', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loginViaUi(page, seed.owner.email, seed.owner.password);

    // ---- 2. regras do pacote ----
    await page.goto('/catalogo/pacotes');
    await page
      .getByRole('row', { name: new RegExp(pkg.name) })
      .getByRole('button', { name: 'Ações' })
      .click();
    await page.getByRole('menuitem', { name: 'Cronograma do dia' }).click();
    const rules = page.getByRole('dialog');
    await expect(rules.getByLabel('Texto do extra 1')).toHaveValue('Chegada fotógrafos');
    await expect(rules.getByTestId('timeline-rule-preview')).toContainText('15:10');
    await page.keyboard.press('Escape');
    await expect(rules).toBeHidden();

    // ---- 3. aba do grupo: simulação, profissionais, cópia ----
    await page.goto(`/noivas/${group.groupId}`);
    await page.getByRole('tab', { name: 'Cronograma do dia' }).click();
    await expect(page.getByTestId('timeline-departure')).toHaveValue('17:00');
    await expect(page.getByTestId('timeline-package')).toHaveValue(pkg.id);

    const generate = page.getByTestId('timeline-generate');
    await generate.click();
    const firstText = page.getByTestId('timeline-sim-0').getByTestId('timeline-text');
    await expect(firstText).toContainText(`Pacote ${pkg.name}`);
    await expect(firstText).toContainText('[a definir]');

    await page.getByTestId('timeline-make').selectOption(makePro.id);
    await page.getByTestId('timeline-hair').selectOption(hairPro.id);
    await generate.click();
    await expect(page.getByTestId('timeline-sim-1')).toBeVisible();
    const latest = page.getByTestId('timeline-simulations').locator('section').first();
    // o texto do WhatsApp mantém "make - profissional" (a profissional vai nas linhas da simulação)
    await expect(latest.getByTestId('timeline-text')).toContainText('make - profissional');
    // as linhas passam a mostrar a profissional (nome curto); quem atende é conferido pela API no passo 5
    await expect(latest.getByTestId('timeline-row-3')).toContainText('— E2E');
    await expect(latest.getByTestId('timeline-row-4')).toContainText('— E2E');

    await latest.getByRole('button', { name: 'Copiar texto' }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain('Chegada fotógrafos: 15:10');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      'make - profissional',
    );

    // ---- 4. ok do studio ----
    await latest.getByRole('button', { name: 'Confirmar (ok do studio)' }).click();
    await expect(page.getByText('Cronograma confirmado')).toBeVisible();
    await expect(page.getByTestId('timeline-official-meta')).toContainText('Versão 1');

    // ---- 5. make e penteado da noiva na agenda (12:30 e 14:00, 90 min) ----
    const appts = await groupAppointmentsOf(group.brideClientId);
    expect(appts).toHaveLength(2);
    const hhmm = (iso: string) =>
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    expect(appts.map((a) => hhmm(a.startsAt))).toEqual(['12:30', '14:00']);
    for (const a of appts) {
      expect(Date.parse(a.endsAt) - Date.parse(a.startsAt)).toBe(90 * 60_000);
    }
    expect(appts[0].professionalId).toBe(makePro.id);
    expect(appts[1].professionalId).toBe(hairPro.id);

    await page.goto(`/agenda?data=${eventDate}&visao=day`);
    await expect(page.getByTestId('view-day')).toBeVisible();
    await expect(
      page.getByTestId(`lane-${makePro.id}`).locator(`[data-testid="appointment-card-${appts[0].id}"]`),
    ).toBeVisible();
    await expect(
      page.getByTestId(`lane-${hairPro.id}`).locator(`[data-testid="appointment-card-${appts[1].id}"]`),
    ).toBeVisible();
  });

  async function openVisitForCompanion(page: import('@playwright/test').Page): Promise<void> {
    await page.goto(`/agenda?data=${eventDate}&visao=day`);
    await expect(page.getByTestId('view-day')).toBeVisible();
    const slot = page.getByTestId(`slot-${freePro.id}-15:00`);
    await slot.scrollIntoViewIfNeeded();
    await slot.click();
    await expect(page.getByTestId('visit-form')).toBeVisible();
    await page.getByTestId('visit-client-search').fill(group.companionName);
    await page.getByTestId(`visit-client-option-${group.companionClientId}`).click();
    await page.getByTestId('visit-line-0-service').selectOption(seed.phase3.serviceId);
    await pickProfessional(page, 0, freePro.id);
    await page.getByTestId('visit-submit').click();
  }

  test('atendente: acompanhante fora da janela é bloqueada e não vê o forçar', async ({ page }) => {
    await loginViaUi(page, attendant.email, attendant.password);
    await openVisitForCompanion(page);
    await expect(page.getByTestId('visit-error')).toContainText('15:30');
    await expect(page.getByRole('button', { name: 'Forçar mesmo assim' })).toHaveCount(0);
    expect(await groupAppointmentsOf(group.companionClientId)).toHaveLength(0);
  });

  test('administrador força com motivo e o agendamento é criado', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await openVisitForCompanion(page);
    const dialog = page.getByRole('dialog', { name: 'Horário fora do cronograma da noiva' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('override-message')).toContainText('15:30');
    await dialog.getByLabel('Motivo').fill('pedido da noiva');
    await dialog.getByRole('button', { name: 'Forçar mesmo assim' }).click();
    await expect(page.getByText(/Agendamento criado/)).toBeVisible();
    // o audit_log não é exposto pela API: confere só que o agendamento existe
    await expect.poll(async () => (await groupAppointmentsOf(group.companionClientId)).length).toBe(1);
  });

  test('o make da noiva (ligado ao cronograma) não anda pela agenda', async () => {
    const [make] = await groupAppointmentsOf(group.brideClientId);
    const moved = await gql<{
      moveAppointment: { appointment: { id: string } | null; errors: { code: string; message: string }[] };
    }>(
      `mutation($i: MoveAppointmentInput!) {
        moveAppointment(input: $i) { appointment { id } errors { code message } }
      }`,
      {
        i: {
          id: make.id,
          professionalId: make.professionalId,
          startsAt: `${eventDate}T10:00:00-03:00`,
        },
      },
      { token },
    );
    expect(moved.moveAppointment.appointment).toBeNull();
    expect(moved.moveAppointment.errors[0].code).toBe('TIMELINE_LINKED_APPOINTMENT');
    expect(moved.moveAppointment.errors[0].message).toContain('Cronograma do dia');
  });
});
