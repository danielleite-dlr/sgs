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

const PREVIEW = `query($input: BridalTimelineInput!) {
  bridalTimelinePreview(input: $input) {
    preview {
      groupId packageName departureTime brideLabel text registryStartsAt missing canConfirm
      warnings { code message }
      rows { time name label kind professionalName isExtra isRegistry }
      brideSlots { kind stepName professionalId startsAt endsAt }
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

  it('3. sem profissionais: [a definir], avisos e missing', async () => {
    const r = await preview({ makeProfessionalId: null, hairProfessionalId: null });
    const p = r.preview;
    expect(p.text.split('[a definir]').length - 1).toBe(2);
    expect(
      p.warnings.filter((x: { code: string }) => x.code === 'PROFESSIONAL_UNDEFINED'),
    ).toHaveLength(2);
    expect(p.missing).toContain('Escolha a profissional de make.');
    expect(p.missing).toContain('Escolha a profissional de penteado.');
    expect(p.canConfirm).toBe(false);
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
    expect(
      ok.preview.warnings.some((x: { code: string }) => x.code === 'ARRIVAL_BEFORE_06'),
    ).toBe(true);
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
