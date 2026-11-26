import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  GLAM_STEPS,
  insertBridalGroupRow,
  insertConfirmedTimelineRow,
  insertPackageTimelineRows,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { markFixed, markServesBridal } from './helpers/phase11-fixtures';

const PREVIEW = `query($input: BridalTimelineInput!) {
  bridalTimelinePreview(input: $input) {
    preview {
      groupId packageName departureTime brideLabel text registryStartsAt missing canConfirm
      warnings { code message }
      rows { time name label kind professionalName isExtra isRegistry }
      brideSlots { kind stepName professionalId professionalName suggested isFixed startsAt endsAt }
      conflicts { stepName professionalName startsAt endsAt blockedBy }
    }
    errors { code message field }
  }
}`;
const GET = `query($groupId: UUID!) {
  bridalTimeline(groupId: $groupId) {
    id version registryLabel packageName
    companionIssues { appointmentId rule message }
  }
}`;

const year = new Date().getFullYear() + 1;
const eventDay = `${year}-11-08`;

/** Horário local de São Paulo (UTC-3, sem horário de verão) como instante ISO. */
function at(hh: number, mm = 0): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${eventDay}T${p(hh + 3)}:${p(mm)}:00.000Z`;
}

describe('Fase 04.2 - simulação do cronograma da noiva', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p42prv-%'`;
  let groupId: string;
  let brideClientId: string;
  let companionClientId: string;

  const att = () => gqlAs(w, w.tokens.attendant);
  const input = (extra: Record<string, unknown> = {}) => ({
    groupId,
    packageId: w.bridalPackageId,
    departureTime: '17:00',
    makeProfessionalId: w.members.proA,
    hairProfessionalId: w.members.proB,
    ...extra,
  });
  const preview = async (extra: Record<string, unknown> = {}) => {
    const res = await att()(PREVIEW, { input: input(extra) });
    return res.data.bridalTimelinePreview as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preview: any;
      errors: { code: string; message: string; field: string | null }[];
    };
  };
  const counts = async () => ({
    appts: await adminPrisma.appointment.count({ where: { organizationId: w.orgId } }),
    timelines: await adminPrisma.bridalTimeline.count({ where: { organizationId: w.orgId } }),
    blocks: await adminPrisma.timeBlock.count({ where: { organizationId: w.orgId } }),
  });

  beforeAll(async () => {
    w = await createPhase4World('p42prv');
    await adminPrisma.package.update({
      where: { id: w.bridalPackageId },
      data: { name: 'Glam' },
    });
    await insertPackageTimelineRows(w, w.bridalPackageId, GLAM_STEPS, {
      makeServiceId: w.serviceId,
      hairServiceId: w.serviceBId,
    });
    const g = await insertBridalGroupRow(w, { companions: 1, eventDate: eventDay });
    groupId = g.groupId;
    brideClientId = g.brideClientId;
    companionClientId = g.companionClientIds[0];
    await adminPrisma.client.update({
      where: { id: brideClientId },
      data: { fullName: 'Vitória Souza' },
    });
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await adminPrisma.appointment.deleteMany({ where: { organizationId: w.orgId } });
    await adminPrisma.timeBlock.deleteMany({ where: { organizationId: w.orgId } });
    await adminPrisma.bridalTimeline.deleteMany({ where: { organizationId: w.orgId } });
    await markFixed([w.members.proA, w.members.proB], false);
    await markServesBridal([w.members.proA, w.members.proB], true);
    await adminPrisma.bridalGroup.update({
      where: { id: groupId },
      data: {
        assistantMemberId: null,
        assistantDailyRate: null,
        assistantLinkedAt: null,
        eventKind: 'noiva',
      },
    });
  });

  const appt = (
    clientId: string,
    pro: string,
    s: string,
    e: string,
    extra: Record<string, unknown> = {},
  ) =>
    adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: pro,
        clientId,
        serviceId: w.serviceId,
        startsAt: new Date(s),
        endsAt: new Date(e),
        ...extra,
      } as never,
    });

  it('1. simula com texto, janelas e sem conflito', async () => {
    const r = await preview();
    expect(r.errors).toEqual([]);
    const p = r.preview;
    expect(p.text.startsWith('CRONOGRAMA NOIVA VITÓRIA - 08/11 - Pacote Glam')).toBe(true);
    expect(p.text).toMatch(/12:30 make - profissional \S+/);
    expect(p.text).toContain('15:30 fotos');
    expect(p.text).toContain('Chegada fotógrafos: 15:10');
    const make = p.brideSlots.find((s: { kind: string }) => s.kind === 'make');
    const hair = p.brideSlots.find((s: { kind: string }) => s.kind === 'hair');
    expect(new Date(make.startsAt).toISOString()).toBe(at(12, 30));
    expect(new Date(make.endsAt).toISOString()).toBe(at(14));
    expect(new Date(hair.startsAt).toISOString()).toBe(at(14));
    expect(new Date(hair.endsAt).toISOString()).toBe(at(15, 30));
    expect(new Date(p.registryStartsAt).toISOString()).toBe(at(15, 30));
    expect(p.conflicts).toEqual([]);
    expect(p.missing).toEqual([]);
    expect(p.canConfirm).toBe(true);
  });

  it('2. brideLabel personalizado vai para o título', async () => {
    const r = await preview({ brideLabel: 'Vitoria' });
    expect(r.preview.text.startsWith('CRONOGRAMA NOIVA VITORIA - 08/11 - Pacote Glam')).toBe(true);
  });

  // 04.2 D-03 revogada por 11 D-06: sem profissional escolhida a simulação já sugere.
  it('3. sem profissionais escolhidas: make e penteado já vêm sugeridos (D-06)', async () => {
    const r = await preview({ makeProfessionalId: null, hairProfessionalId: null });
    const p = r.preview;
    expect(r.errors).toEqual([]);
    for (const kind of ['make', 'hair']) {
      const slot = p.brideSlots.find((x: { kind: string }) => x.kind === kind);
      expect(slot.professionalId).toBeTruthy();
      expect(slot.suggested).toBe(true);
      expect(p.text).toContain(slot.professionalName);
    }
    expect(p.text).not.toContain('[a definir]');
    expect(
      p.warnings.filter((x: { code: string }) => x.code === 'PROFESSIONAL_UNDEFINED'),
    ).toHaveLength(0);
    expect(p.missing).toEqual([]);
  });

  it('3b. fixa é sugerida antes da não fixa (D-18)', async () => {
    await markFixed([w.members.proB]);
    const r = await preview({ makeProfessionalId: null, hairProfessionalId: null });
    const make = r.preview.brideSlots.find((x: { kind: string }) => x.kind === 'make');
    expect(make.professionalId).toBe(w.members.proB);
    expect(make.suggested).toBe(true);
    expect(make.isFixed).toBe(true);
  });

  it('3c. entre duas fixas, a com menos minutos no dia (D-10)', async () => {
    await markFixed([w.members.proA, w.members.proB]);
    const other = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Cliente Minutos' },
    });
    await appt(other.id, w.members.proB, at(9), at(11));
    const r = await preview({ makeProfessionalId: null, hairProfessionalId: null });
    const make = r.preview.brideSlots.find((x: { kind: string }) => x.kind === 'make');
    expect(make.professionalId).toBe(w.members.proA);
  });

  it('3d. escolhida explícita nunca é trocada e vem suggested false', async () => {
    await markFixed([w.members.proB]);
    const r = await preview({ makeProfessionalId: w.members.proA, hairProfessionalId: null });
    const make = r.preview.brideSlots.find((x: { kind: string }) => x.kind === 'make');
    expect(make.professionalId).toBe(w.members.proA);
    expect(make.suggested).toBe(false);
  });

  it('3e. todas ocupadas no horário do make: sem profissional e aviso NO_FREE_PROFESSIONAL', async () => {
    const other = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Cliente Ocupada 2' },
    });
    await appt(other.id, w.members.proA, at(12, 30), at(14));
    await appt(other.id, w.members.proB, at(12, 30), at(14));
    const r = await preview({ makeProfessionalId: null, hairProfessionalId: null });
    const make = r.preview.brideSlots.find((x: { kind: string }) => x.kind === 'make');
    expect(make.professionalId).toBeNull();
    expect(
      r.preview.warnings.some((x: { code: string }) => x.code === 'NO_FREE_PROFESSIONAL'),
    ).toBe(true);
    expect(r.preview.canConfirm).toBe(false);
  });

  it('3f. a assistente do grupo nunca é sugerida', async () => {
    await adminPrisma.bridalGroup.update({
      where: { id: groupId },
      data: {
        assistantMemberId: w.members.proA,
        assistantDailyRate: '220.00',
        assistantLinkedAt: new Date(),
      },
    });
    const r = await preview({ makeProfessionalId: null, hairProfessionalId: null });
    for (const s of r.preview.brideSlots) {
      expect(s.professionalId).not.toBe(w.members.proA);
    }
  });

  it('3g. debutante: mesma sugestão e título no formato da 04.2 (D-17, D-21)', async () => {
    await adminPrisma.bridalGroup.update({
      where: { id: groupId },
      data: { eventKind: 'debutante' },
    });
    const r = await preview({ makeProfessionalId: null, hairProfessionalId: null });
    expect(r.preview.text.startsWith('CRONOGRAMA NOIVA VITÓRIA - 08/11 - Pacote Glam')).toBe(true);
    for (const s of r.preview.brideSlots) {
      expect(s.suggested).toBe(true);
      expect(s.professionalId).toBeTruthy();
    }
  });

  it('4. conflito com outra cliente aparece com quem ocupa e horário', async () => {
    const other = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Cliente Ocupada' },
    });
    await appt(other.id, w.members.proA, at(13), at(13, 30));
    const r = await preview();
    expect(r.preview.conflicts).toHaveLength(1);
    expect(r.preview.conflicts[0].blockedBy).toContain('Cliente Ocupada');
    expect(r.preview.conflicts[0].blockedBy).toContain('13:00');
    expect(r.preview.canConfirm).toBe(false);
  });

  it('4b. agendamento importado da noiva (sem grupo) é adotável; de outra cliente conflita', async () => {
    await appt(brideClientId, w.members.proA, at(12), at(13));
    let r = await preview();
    expect(r.preview.conflicts).toEqual([]);
    expect(r.preview.canConfirm).toBe(true);

    await adminPrisma.appointment.deleteMany({ where: { organizationId: w.orgId } });
    await appt(companionClientId, w.members.proA, at(12), at(13));
    r = await preview();
    expect(r.preview.conflicts).toHaveLength(1);
  });

  it('4c. deslocamento do próprio grupo é ignorado; folga conflita', async () => {
    await adminPrisma.timeBlock.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        kind: 'deslocamento',
        startsAt: new Date(at(12)),
        endsAt: new Date(at(12, 45)),
        bridalGroupId: groupId,
      },
    });
    let r = await preview();
    expect(r.preview.conflicts).toEqual([]);

    await adminPrisma.timeBlock.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        kind: 'folga',
        startsAt: new Date(at(12)),
        endsAt: new Date(at(12, 45)),
      },
    });
    r = await preview();
    expect(r.preview.conflicts).toHaveLength(1);
    expect(r.preview.conflicts[0].blockedBy).toBe('Bloqueio: folga');
  });

  it('5. pacote sem regra devolve TIMELINE_RULES_MISSING', async () => {
    const empty = await adminPrisma.package.create({
      data: {
        organizationId: w.orgId,
        name: 'p42prv-vazio',
        price: '100.00',
        depositKind: 'percent',
        depositValue: '30.00',
      },
    });
    const r = await preview({ packageId: empty.id });
    expect(r.preview).toBeNull();
    expect(r.errors[0].code).toBe('TIMELINE_RULES_MISSING');
  });

  it('6. saída inválida, antes da meia-noite e chegada antes das 06h', async () => {
    const early = await preview({ departureTime: '07:00' });
    expect(early.errors[0].code).toBe('BEFORE_MIDNIGHT');
    const bad = await preview({ departureTime: '7h' });
    expect(bad.errors[0].code).toBe('INVALID_DEPARTURE');
    const ok = await preview({ departureTime: '13:00' });
    expect(ok.preview).not.toBeNull();
    expect(ok.preview.warnings.some((x: { code: string }) => x.code === 'ARRIVAL_BEFORE_06')).toBe(
      true,
    );
  });

  it('7. simulação não grava nada', async () => {
    const before = await counts();
    for (let i = 0; i < 5; i++) await preview();
    expect(await counts()).toEqual(before);
  });

  it('8. bridalTimeline: null e depois o confirmado com acompanhante fora da regra', async () => {
    const none = await att()(GET, { groupId });
    expect(none.data.bridalTimeline).toBeNull();

    await insertConfirmedTimelineRow(w, {
      groupId,
      packageId: w.bridalPackageId,
      departureTime: '17:00',
      departureAt: at(17),
      registryStartsAt: at(15, 30),
      registryLabel: 'fotos',
      brideLabel: 'VITÓRIA',
    });
    const acomp = await appt(companionClientId, w.members.proB, at(15), at(16));
    const res = await att()(GET, { groupId });
    const t = res.data.bridalTimeline;
    expect(t.version).toBe(1);
    expect(t.registryLabel).toBe('fotos');
    expect(t.companionIssues).toHaveLength(1);
    expect(t.companionIssues[0].appointmentId).toBe(acomp.id);
    expect(t.companionIssues[0].rule).toBe('TIMELINE_AFTER_REGISTRY');
  });

  it('9. profissional sem bridal.read é barrada; outra org não enxerga o grupo', async () => {
    const res = await gqlAs(w, w.tokens.proA)(PREVIEW, { input: input() });
    const e = res.errors?.[0];
    expect(!!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`)).toBe(true);

    const other = await gqlAs(w, w.tokens.otherAdmin)(PREVIEW, { input: input() });
    expect(other.data.bridalTimelinePreview.preview).toBeNull();
    expect(other.data.bridalTimelinePreview.errors[0].code).toBe('NOT_FOUND');
  });

  afterAll(async () => {
    await deletePhase4Rows(orgFilter);
  });
});
