import { expect, test } from '@playwright/test';
import { pickSearchable } from '../support/agenda-ui';
import { openRowActions } from '../support/ui';
import { gql, expectNoUserErrors } from '../support/graphql';
import { createProfessional, ownerToken, type CreatedPro } from '../support/phase3';
import { firstWednesdayFromNow, setStudioSettings } from '../support/phase4';
import {
  createGlamPackage,
  createGroupWithCompanion,
  ensureAttendant,
  setGlamTimeline,
  type GroupWithCompanion,
} from '../support/phase42';
import { markPriorityFlags } from '../support/phase11';
import { readSeedState, type SeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

test.use({ viewport: { width: 1600, height: 1500 } });

test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

/**
 * Fase 11: prioridade de profissionais e cronograma da noiva, ponta a ponta.
 * marcar fixa/atende noiva -> simulação já preenchida com a fixa -> confirmar ->
 * acompanhante depois do limite é recusada -> agendamento comum sugere a fixa -> debutante igual.
 */
test.describe('Prioridade de profissionais e cronograma da noiva (fase 11)', () => {
  let seed: SeedState;
  let token: string;
  let fixa: CreatedPro;
  let pkg: Awaited<ReturnType<typeof createGlamPackage>>;
  let attendant: Awaited<ReturnType<typeof ensureAttendant>>;
  let group: GroupWithCompanion;
  const unique = Date.now().toString(36);
  // datas próprias (distintas dos outros specs de cronograma)
  const eventDate = firstWednesdayFromNow(61);
  const debutanteDate = firstWednesdayFromNow(68);

  test.beforeAll(async () => {
    seed = readSeedState();
    token = await ownerToken(seed);
    fixa = await createProfessional(seed, token, 'PrioFixa');
    pkg = await createGlamPackage(seed, token, { name: `Glam Prio ${unique}`, price: '3000.00' });
    await setGlamTimeline(token, pkg.id, pkg.makeServiceId, pkg.hairServiceId);
    await setStudioSettings(token);
    attendant = await ensureAttendant(seed, token);
    group = await createGroupWithCompanion(seed, token, {
      packageId: pkg.id,
      eventDate,
      readyBy: '17:00',
      unique,
    });
  });

  test.afterAll(async () => {
    // não deixa "fixa" vazar para os outros specs (a sugestão passaria a preferi-la)
    if (fixa) await markPriorityFlags(token, fixa.id, { isFixed: false });
  });

  test('1. dona marca a profissional como fixa em Profissionais', async ({ page }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto('/profissionais');
    const row = page.getByRole('row', { name: new RegExp(fixa.name) });
    await expect(row).toBeVisible();
    // "atende noiva" já vem do seed/criação; ainda não é fixa
    await expect(page.getByTestId(`member-serves-bridal-badge-${fixa.id}`)).toBeVisible();
    await expect(page.getByTestId(`member-fixed-badge-${fixa.id}`)).toHaveCount(0);

    await openRowActions(page, new RegExp(fixa.name));
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const edit = page.getByRole('dialog');
    await expect(edit.getByTestId('member-serves-bridal')).toBeChecked();
    await edit.getByTestId('member-fixed').check();
    await edit.getByRole('button', { name: 'Salvar' }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByTestId(`member-fixed-badge-${fixa.id}`)).toBeVisible();
  });

  test('2. simulação da noiva já vem preenchida com a fixa; confirmar cria o cronograma', async ({
    page,
  }) => {
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/noivas/${group.groupId}`);
    await page.getByRole('tab', { name: 'Cronograma do dia' }).click();
    await expect(page.getByTestId('timeline-departure')).toHaveValue('17:00');
    await page.getByTestId('timeline-package').selectOption(pkg.id);
    await page.getByTestId('timeline-generate').click();

    const sim = page.getByTestId('timeline-sim-0');
    await expect(sim.getByTestId('slot-suggested-make')).toBeVisible();
    await expect(sim.getByTestId('slot-suggested-hair')).toBeVisible();
    // única fixa elegível: make e penteado sugeridos para ela
    await expect(sim.getByTestId('timeline-text')).not.toContainText('[a definir]');
    await expect(page.getByTestId('timeline-make')).toHaveValue(fixa.id);
    await expect(page.getByTestId('timeline-hair')).toHaveValue(fixa.id);
    await expect(sim.getByTestId('slot-not-fixed-make')).toHaveCount(0);

    // acompanhantes prontas 30 min antes do make-off (15:30) => 15:00
    await page.getByTestId('timeline-companions-ready').fill('15:00');
    await page.getByTestId('timeline-generate').click();
    const latest = page.getByTestId('timeline-simulations').locator('section').first();
    await expect(page.getByTestId('timeline-sim-1')).toBeVisible();
    await latest.getByRole('button', { name: 'Confirmar (ok do studio)' }).click();
    await expect(page.getByText('Cronograma confirmado')).toBeVisible();
    await expect(page.getByTestId('timeline-official-meta')).toContainText('Versão 1');
  });

  test('3. acompanhante que termina depois do limite é recusada com a mensagem da saída', async ({
    page,
  }) => {
    // outra profissional livre: a recusa tem de vir do limite, não de conflito com a fixa
    const livre = await createProfessional(seed, token, 'PrioLivre');
    await loginViaUi(page, attendant.email, attendant.password);
    await page.goto(`/agenda?data=${eventDate}&visao=day`);
    await expect(page.getByTestId('view-day')).toBeVisible();
    const slot = page.getByTestId(`slot-${livre.id}-14:30`);
    await slot.scrollIntoViewIfNeeded();
    await slot.click();
    await expect(page.getByTestId('visit-form')).toBeVisible();
    await page.getByTestId('visit-client-search').fill(group.companionName);
    await page.getByTestId(`visit-client-option-${group.companionClientId}`).click();
    await pickSearchable(page, 'visit-line-0-service', seed.phase3.serviceId);
    await page.getByTestId('visit-submit').click();
    await expect(page.getByTestId('visit-error')).toContainText('saída das acompanhantes');
    await expect(page.getByTestId('visit-error')).toContainText('pronta até 15h');
    await expect(page.getByRole('button', { name: 'Forçar mesmo assim' })).toHaveCount(0);
  });

  test('4. agendamento comum já vem com a fixa livre pré-selecionada', async ({ page }) => {
    const day = firstWednesdayFromNow(75);
    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/agenda?data=${day}&visao=day`);
    await expect(page.getByTestId('view-day')).toBeVisible();
    await page.getByRole('button', { name: 'Agendar', exact: true }).click();
    await expect(page.getByTestId('visit-form')).toBeVisible();
    await pickSearchable(page, 'visit-line-0-service', seed.phase3.serviceId);
    await page.getByTestId('visit-line-0-time').fill('10:00');

    await expect(page.getByTestId('visit-line-0-suggestion')).toContainText('Sugestão do sistema', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('visit-line-0-suggestion')).toContainText(fixa.name);
    await expect(page.getByTestId('visit-line-0-suggestion')).toContainText('fixa livre');

    // a profissional marcada é a fixa (select ou controle segmentado, conforme o nº de profissionais)
    const el = page.getByTestId('visit-line-0-professional');
    if (await el.count()) {
      await expect(el).toHaveValue(fixa.id);
    } else {
      await expect(page.getByTestId(`visit-line-0-professional-${fixa.id}`)).toHaveAttribute(
        'aria-checked',
        'true',
      );
    }
  });

  test('5. debutante: a simulação também sugere a fixa', async ({ page }) => {
    const created = await gql<{
      createBridalGroup: { group: { id: string } | null; errors: never[] };
    }>(
      `mutation($input: CreateBridalGroupInput!) {
        createBridalGroup(input: $input) { group { id } errors { code message } }
      }`,
      {
        input: {
          group: {
            name: `Debutante Prio ${unique}`,
            eventDate: debutanteDate,
            eventTime: '20:00',
            eventKind: 'debutante',
            readyBy: `${debutanteDate}T17:00:00-03:00`,
            packageId: pkg.id,
            newResponsible: { fullName: `Responsavel Prio ${unique}`, phone: '11987654323' },
          },
          bride: { newClient: { fullName: `Debutante Prio ${unique}`, phone: '11987654324' } },
        },
      },
      { token },
    );
    expectNoUserErrors(created.createBridalGroup, 'createBridalGroup debutante');
    const groupId = created.createBridalGroup.group!.id;

    await loginViaUi(page, seed.owner.email, seed.owner.password);
    await page.goto(`/noivas/${groupId}`);
    await page.getByRole('tab', { name: 'Cronograma do dia' }).click();
    await page.getByTestId('timeline-package').selectOption(pkg.id);
    await page.getByTestId('timeline-generate').click();
    const sim = page.getByTestId('timeline-sim-0');
    await expect(sim.getByTestId('slot-suggested-make')).toBeVisible();
    await expect(page.getByTestId('timeline-make')).toHaveValue(fixa.id);
    await expect(sim.getByTestId('timeline-text')).not.toContainText('[a definir]');
  });
});

// Celular: os selos de fixa/atende noiva cabem na tela e a simulação aparece sem rolagem lateral.
test.describe('Prioridade de profissionais no celular (fase 11)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(90_000);

  test('selos em Profissionais e simulação sem estourar a largura', async ({ page }) => {
    const seed = readSeedState();
    const token = await ownerToken(seed);
    const unique = Date.now().toString(36);
    const pro = await createProfessional(seed, token, 'PrioCel');
    await markPriorityFlags(token, pro.id, { isFixed: true, servesBridal: true });
    try {
      const cpkg = await createGlamPackage(seed, token, { name: `Glam Cel ${unique}`, price: '3000.00' });
      await setGlamTimeline(token, cpkg.id, cpkg.makeServiceId, cpkg.hairServiceId);
      await setStudioSettings(token);
      const date = firstWednesdayFromNow(82);
      const g = await createGroupWithCompanion(seed, token, {
        packageId: cpkg.id,
        eventDate: date,
        readyBy: '17:00',
        unique,
      });

      await loginViaUi(page, seed.owner.email, seed.owner.password);
      await page.goto('/profissionais');
      await expect(page.getByTestId(`member-fixed-badge-${pro.id}`)).toBeVisible();
      await expect(page.getByTestId(`member-serves-bridal-badge-${pro.id}`)).toBeVisible();

      await page.goto(`/noivas/${g.groupId}`);
      await page.getByRole('tab', { name: 'Cronograma do dia' }).click();
      await page.getByTestId('timeline-package').selectOption(cpkg.id);
      await page.getByTestId('timeline-generate').click();
      await expect(page.getByTestId('timeline-sim-0').getByTestId('slot-suggested-make')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    } finally {
      await markPriorityFlags(token, pro.id, { isFixed: false });
    }
  });
});
