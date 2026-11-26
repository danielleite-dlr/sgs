import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { markFixed, markServesBridal } from './helpers/phase11-fixtures';

const NEW_EMAIL = 'p11flags-nova@teste.com';
const NEW_EMAIL_2 = 'p11flags-atendente@teste.com';

const CREATE = `mutation($i: CreateMemberInput!) { createMember(input: $i) {
  member { id isProfessional isFixed servesBridal }
  errors { code message field } } }`;
const UPDATE = `mutation($i: UpdateMemberInput!) { updateMember(input: $i) {
  member { id isProfessional isFixed servesBridal }
  errors { code message field } } }`;
const ALL = `query { allMembers { id displayName isFixed servesBridal } }`;
const FOR_SERVICE = `query($s: UUID!, $b: Boolean) {
  professionalsForService(serviceId: $s, bridal: $b) { id isFixed servesBridal } }`;

type Row = { id: string; isFixed: boolean; servesBridal: boolean };

describe('11 — marcações fixa e atende noiva/debutante', () => {
  let w: Phase4World;

  const cleanupNew = async () => {
    for (const email of [NEW_EMAIL, NEW_EMAIL_2]) {
      await adminPrisma.$executeRawUnsafe(
        `DELETE FROM member_categories WHERE member_id IN (SELECT id FROM members WHERE user_id IN (SELECT id FROM users WHERE email = '${email}'))`,
      );
      await adminPrisma.$executeRawUnsafe(
        `DELETE FROM members WHERE user_id IN (SELECT id FROM users WHERE email = '${email}')`,
      );
      await adminPrisma.$executeRawUnsafe(
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = '${email}')`,
      );
      await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email = '${email}'`);
    }
  };

  beforeAll(async () => {
    await cleanupNew();
    w = await createPhase4World('p11flags', { bridalPros: false });
  });

  afterAll(async () => {
    await cleanupNew();
    await destroyPhase4World(w);
  });

  const baseInput = (extra: Record<string, unknown>) => ({
    displayName: 'p11flags Nova',
    email: NEW_EMAIL,
    phone: '(11) 98765-4321',
    pixKey: '123.456.789-09',
    temporaryPassword: 'Prov1sorio-Senha',
    ...extra,
  });

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it('por padrão ninguém vem marcada (D-03)', async () => {
    const res = await gqlAs(w, w.tokens.admin)(ALL);
    const rows = res.data!.allMembers as Row[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.isFixed === false && r.servesBridal === false)).toBe(true);
  });

  it('professionalsForService(bridal: true) sem ninguém marcada devolve [] (D-04)', async () => {
    const res = await gqlAs(w, w.tokens.admin)(FOR_SERVICE, {
      s: w.serviceId,
      b: true,
    });
    expect(res.errors).toBeUndefined();
    expect(res.data!.professionalsForService).toEqual([]);
  });

  it('ADMIN marca fixa e atende noiva e allMembers reflete', async () => {
    const res = await gqlAs(w, w.tokens.admin)(UPDATE, {
      i: { id: w.members.proA, isFixed: true, servesBridal: true },
    });
    expect(res.data!.updateMember.errors).toEqual([]);
    expect(res.data!.updateMember.member.isFixed).toBe(true);
    expect(res.data!.updateMember.member.servesBridal).toBe(true);
    const list = await gqlAs(w, w.tokens.admin)(ALL);
    const a = (list.data!.allMembers as Row[]).find((m) => m.id === w.members.proA);
    expect(a).toMatchObject({ isFixed: true, servesBridal: true });
  });

  it('não profissional não pode ser marcada na edição', async () => {
    const res = await gqlAs(w, w.tokens.admin)(UPDATE, {
      i: { id: w.members.attendant, isFixed: true },
    });
    expect(res.data!.updateMember.member).toBeNull();
    expect(res.data!.updateMember.errors[0]).toMatchObject({
      code: 'PRIORITY_FLAG_REQUIRES_PROFESSIONAL',
      field: 'isFixed',
    });
  });

  it('criação: profissional volta marcada; atendente com servesBridal é recusada', async () => {
    const ok = await gqlAs(w, w.tokens.admin)(CREATE, {
      i: baseInput({
        roleName: 'PROFESSIONAL',
        isProfessional: true,
        servesBridal: true,
        categoryIds: [w.categoryId],
      }),
    });
    expect(ok.data!.createMember.errors).toEqual([]);
    expect(ok.data!.createMember.member.servesBridal).toBe(true);
    expect(ok.data!.createMember.member.isFixed).toBe(false);

    const bad = await gqlAs(w, w.tokens.admin)(CREATE, {
      i: baseInput({
        email: NEW_EMAIL_2,
        roleName: 'ATTENDANT',
        isProfessional: false,
        servesBridal: true,
      }),
    });
    expect(bad.data!.createMember.member).toBeNull();
    expect(bad.data!.createMember.errors[0]).toMatchObject({
      code: 'PRIORITY_FLAG_REQUIRES_PROFESSIONAL',
      field: 'servesBridal',
    });
  });

  it('filtro bridal: só proA (marcada); sem bridal vêm proA e proB', async () => {
    const run = gqlAs(w, w.tokens.admin);
    const onlyBridal = await run(FOR_SERVICE, { s: w.serviceId, b: true });
    const bridalIds = ids(onlyBridal.data!.professionalsForService);
    expect(bridalIds).toContain(w.members.proA);
    expect(bridalIds).not.toContain(w.members.proB);

    const all = await run(FOR_SERVICE, { s: w.serviceId });
    const allIds = ids(all.data!.professionalsForService);
    expect(allIds).toEqual(expect.arrayContaining([w.members.proA, w.members.proB]));

    await markServesBridal([w.members.proB]);
    const both = await run(FOR_SERVICE, { s: w.serviceId, b: true });
    expect(ids(both.data!.professionalsForService)).toEqual(
      expect.arrayContaining([w.members.proA, w.members.proB]),
    );
  });

  it('ordem: fixa primeiro mesmo com o nome depois (D-09)', async () => {
    await markFixed([w.members.proA], false);
    await markFixed([w.members.proB], true);
    const res = await gqlAs(w, w.tokens.admin)(FOR_SERVICE, { s: w.serviceId });
    const list = ids(res.data!.professionalsForService);
    expect(list.indexOf(w.members.proB)).toBeGreaterThanOrEqual(0);
    expect(list.indexOf(w.members.proB)).toBeLessThan(list.indexOf(w.members.proA));
  });

  it('allMembers mantém a ordem por nome (grade da Agenda, D-20)', async () => {
    const res = await gqlAs(w, w.tokens.admin)(ALL);
    const rows = res.data!.allMembers as Row[];
    const a = rows.findIndex((r) => r.id === w.members.proA);
    const b = rows.findIndex((r) => r.id === w.members.proB);
    expect(a).toBeLessThan(b);
  });

  it('deixar de ser profissional zera as duas marcações', async () => {
    await markFixed([w.members.proA]);
    await markServesBridal([w.members.proA]);
    const res = await gqlAs(w, w.tokens.admin)(UPDATE, {
      i: { id: w.members.proA, roleName: 'ATTENDANT', isProfessional: false },
    });
    expect(res.data!.updateMember.errors).toEqual([]);
    expect(res.data!.updateMember.member.isProfessional).toBe(false);
    expect(res.data!.updateMember.member.isFixed).toBe(false);
    expect(res.data!.updateMember.member.servesBridal).toBe(false);
  });

  it('RLS: admin de outra organização não enxerga as profissionais', async () => {
    const res = await gqlAs(w, w.tokens.otherAdmin)(FOR_SERVICE, {
      s: w.serviceId,
    });
    expect(res.data!.professionalsForService).toEqual([]);
  });

  it('PROFESSIONAL não consegue editar as marcações de outra pessoa', async () => {
    const res = await gqlAs(w, w.tokens.proB)(UPDATE, {
      i: { id: w.members.manager, isFixed: true },
    });
    expect(res.errors?.length ?? 0).toBeGreaterThan(0);
    expect(res.data?.updateMember ?? null).toBeNull();
    const row = await adminPrisma.member.findUnique({
      where: { id: w.members.manager },
    });
    expect(row?.isFixed).toBe(false);
  });
});
