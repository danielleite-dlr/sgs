import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { markFixed, markServesBridal } from './helpers/phase11-fixtures';

const SUGGEST = `query($s: UUID!, $a: DateTime!, $b: DateTime!, $br: Boolean, $ig: [UUID!]) {
  suggestProfessionals(serviceId: $s, startsAt: $a, endsAt: $b, bridal: $br, ignoreAppointmentIds: $ig) {
    professionalId displayName isFixed free dayMinutes suggested
  }
}`;

type Row = {
  professionalId: string;
  isFixed: boolean;
  free: boolean;
  dayMinutes: number;
  suggested: boolean;
};

/** YYYY-MM-DD de hoje + n dias no fuso de São Paulo. */
function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
/** Horário local de São Paulo (UTC-3, sem horário de verão) como Date. */
function at(day: string, hh: number, mm = 0): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + ((hh + 3) * 60 + mm) * 60_000);
}

describe('11 - suggestProfessionals (sugestão no agendamento)', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p11sug-%'`;
  const day = localDay(35);
  const startsAt = at(day, 10);
  const endsAt = at(day, 11);

  async function reset() {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await deletePhase4Rows(orgFilter);
    await markFixed([w.members.proA, w.members.proB], false);
    await markServesBridal([w.members.proA, w.members.proB], false);
  }

  beforeAll(async () => {
    w = await createPhase4World('p11sug', { bridalPros: false });
  });
  afterAll(async () => {
    await reset();
    await destroyPhase4World(w);
  });
  beforeEach(reset);

  const appt = (
    professionalId: string,
    from: Date,
    to: Date,
    extra: Record<string, unknown> = {},
  ) =>
    adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: from,
        endsAt: to,
        ...extra,
      },
    });

  const suggest = async (
    token = w.tokens.admin,
    extra: Record<string, unknown> = {},
  ): Promise<Row[]> => {
    const res = await gqlAs(w, token)(SUGGEST, {
      s: w.serviceId,
      a: startsAt.toISOString(),
      b: endsAt.toISOString(),
      ...extra,
    });
    expect(res.errors).toBeUndefined();
    return res.data!.suggestProfessionals as Row[];
  };
  const ids = (rows: Row[]) => rows.map((r) => r.professionalId);

  it('fixa livre vem na frente da não fixa livre e só ela é suggested', async () => {
    await markFixed([w.members.proB]);
    const rows = await suggest();
    expect(ids(rows)).toEqual([w.members.proB, w.members.proA]);
    expect(rows.map((r) => r.suggested)).toEqual([true, false]);
    expect(rows.every((r) => r.free)).toBe(true);
  });

  it('fixa ocupada no horário: a não fixa livre vira a sugerida', async () => {
    await markFixed([w.members.proB]);
    await appt(w.members.proB, at(day, 10, 30), at(day, 11, 30));
    const rows = await suggest();
    expect(ids(rows)).toEqual([w.members.proA, w.members.proB]);
    expect(rows[0]).toMatchObject({ free: true, suggested: true });
    expect(rows[1]).toMatchObject({ free: false, suggested: false });
  });

  it('duas fixas livres: menos minutos no dia vence (D-10)', async () => {
    await markFixed([w.members.proA, w.members.proB]);
    await appt(w.members.proA, at(day, 13), at(day, 15));
    await appt(w.members.proB, at(day, 13), at(day, 13, 30));
    const rows = await suggest();
    expect(ids(rows)).toEqual([w.members.proB, w.members.proA]);
    expect(rows[0]).toMatchObject({ suggested: true, dayMinutes: 30 });
    expect(rows[1]).toMatchObject({ suggested: false, dayMinutes: 120 });
  });

  it('mesmos minutos: quem recebeu agendamento há mais tempo vence (D-11)', async () => {
    await markFixed([w.members.proA, w.members.proB]);
    await appt(w.members.proA, at(day, 14), at(day, 15), { createdAt: new Date() });
    await appt(w.members.proB, at(day, 14), at(day, 15), {
      createdAt: new Date(Date.now() - 5 * 86_400_000),
    });
    const rows = await suggest();
    expect(ids(rows)).toEqual([w.members.proB, w.members.proA]);
    expect(rows[0].suggested).toBe(true);
  });

  it('ninguém livre: todas suggested false', async () => {
    await appt(w.members.proA, at(day, 10), at(day, 11));
    await appt(w.members.proB, at(day, 10), at(day, 11));
    const rows = await suggest();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !r.free && !r.suggested)).toBe(true);
  });

  it('cancelado não ocupa a profissional', async () => {
    await appt(w.members.proA, at(day, 10), at(day, 11), { status: 'cancelled' });
    const rows = await suggest();
    expect(rows.every((r) => r.free)).toBe(true);
  });

  it('bridal true: sem marcadas devolve []; com proA marcada só ela', async () => {
    expect(await suggest(w.tokens.admin, { br: true })).toEqual([]);
    await markServesBridal([w.members.proA]);
    const rows = await suggest(w.tokens.admin, { br: true });
    expect(ids(rows)).toEqual([w.members.proA]);
    expect(rows[0].suggested).toBe(true);
  });

  it('endsAt <= startsAt devolve []', async () => {
    const res = await gqlAs(w, w.tokens.admin)(SUGGEST, {
      s: w.serviceId,
      a: endsAt.toISOString(),
      b: startsAt.toISOString(),
    });
    expect(res.errors).toBeUndefined();
    expect(res.data!.suggestProfessionals).toEqual([]);
  });

  it('ignoreAppointmentIds devolve a profissional como livre', async () => {
    await markFixed([w.members.proB]);
    const a = await appt(w.members.proB, at(day, 10), at(day, 11));
    const before = await suggest();
    expect(before.find((r) => r.professionalId === w.members.proB)!.free).toBe(false);
    const after = await suggest(w.tokens.admin, { ig: [a.id] });
    expect(after[0]).toMatchObject({
      professionalId: w.members.proB,
      free: true,
      suggested: true,
      dayMinutes: 0,
    });
  });

  it('PROFESSIONAL e ATTENDANT conseguem consultar (MEMBER_READ)', async () => {
    expect(await suggest(w.tokens.proA)).toHaveLength(2);
    expect(await suggest(w.tokens.attendant)).toHaveLength(2);
  });

  it('outra organização não vê as profissionais deste salão', async () => {
    const rows = await suggest(w.tokens.otherAdmin);
    expect(rows).toEqual([]);
  });

  it('serviço inexistente devolve []', async () => {
    const res = await gqlAs(w, w.tokens.admin)(SUGGEST, {
      s: '00000000-0000-7000-8000-000000000000',
      a: startsAt.toISOString(),
      b: endsAt.toISOString(),
    });
    expect(res.errors).toBeUndefined();
    expect(res.data!.suggestProfessionals).toEqual([]);
  });
});
