import request from 'supertest';
import { adminPrisma } from './setup';
import { gqlAs } from './helpers/phase4-fixtures';
import {
  createPhase91World,
  destroyPhase91World,
  insertStudioBrideGroup,
  type Phase91World,
} from './helpers/phase91-fixtures';
import { PasswordService } from '../../src/auth/password.service';

const PREFIX = 'p11ast';
/** Prefixo próprio dos membros criados aqui (o mundo usa PREFIX nos nomes dele). */
const TAG = 'zz11ast';

const CREATE = `mutation($i: CreateMemberInput!) { createMember(input: $i) {
  member { id email roleName isProfessional isBridalAssistant isFixed servesBridal categories { id } }
  errors { code message field } } }`;
const UPDATE = `mutation($i: UpdateMemberInput!) { updateMember(input: $i) {
  member { id roleName isProfessional isBridalAssistant isFixed servesBridal categories { id } }
  errors { code message field } } }`;
const RESET = `mutation($i: ResetMemberPasswordInput!) { resetMemberPassword(input: $i) {
  temporaryPassword member { id } errors { code message field } } }`;
const LOGIN = `mutation($i: LoginInput!) { login(input: $i) {
  accessToken errors { code message } } }`;
const SET_ACCESS = `mutation($i: SetMemberAccessInput!) { setMemberAccess(input: $i) {
  errors { code message } } }`;
const ALL = `query { allMembers { id displayName } }`;
const CANDIDATES = `query($g: UUID!) {
  bridalAssistantCandidates(groupId: $g) { memberId displayName available } }`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

type Member = {
  id: string;
  email: string;
  roleName: string;
  isProfessional: boolean;
  isBridalAssistant: boolean;
  isFixed: boolean;
  servesBridal: boolean;
  categories: { id: string }[];
};

describe('11 G-01 — papel Assistente', () => {
  let w: Phase91World;

  const adm = () => gqlAs(w, w.tokens.admin);

  const input = (tag: string, extra: Record<string, unknown> = {}) => ({
    displayName: `${TAG} ${tag}`,
    phone: '(11) 98765-4321',
    pixKey: '123.456.789-09',
    ...extra,
  });

  const createAssistant = async (tag: string, extra: Record<string, unknown> = {}) => {
    const res = await adm()(CREATE, { i: input(tag, { roleName: 'ASSISTANT', ...extra }) });
    expect(res.errors).toBeUndefined();
    expect(res.data.createMember.errors).toEqual([]);
    return res.data.createMember.member as Member;
  };

  const cleanup = async () => {
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = NULL, assistant_daily_rate = NULL, assistant_linked_at = NULL
        WHERE assistant_member_id IN (SELECT id FROM members WHERE display_name LIKE '${TAG} %')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE professional_id IN (SELECT id FROM members WHERE display_name LIKE '${TAG} %')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_categories WHERE member_id IN (SELECT id FROM members WHERE display_name LIKE '${TAG} %')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_access_overrides WHERE member_id IN (SELECT id FROM members WHERE display_name LIKE '${TAG} %')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE full_name LIKE '${TAG} %')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE '${TAG} %'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE full_name LIKE '${TAG} %'`,
    );
  };

  beforeAll(async () => {
    await cleanup();
    w = await createPhase91World(PREFIX);
  });
  afterAll(async () => {
    await cleanup();
    await destroyPhase91World(w);
  });
  afterEach(cleanup);

  it('papel de sistema ASSISTANT existe e não tem permissões', async () => {
    const roles = await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM roles WHERE name = 'ASSISTANT' AND is_system`,
    );
    expect(Number(roles[0].n)).toBe(1);
    const perms = await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.name = 'ASSISTANT'`,
    );
    expect(Number(perms[0].n)).toBe(0);
  });

  it('createMember ASSISTANT sem e-mail e sem senha; marcações forçadas', async () => {
    const m = await createAssistant('Sem login');
    expect(m).toMatchObject({
      roleName: 'ASSISTANT',
      isProfessional: true,
      isBridalAssistant: true,
      isFixed: false,
      servesBridal: false,
      categories: [],
    });
    expect(m.email).toMatch(/^assistente\..+@sem-login\.invalid$/);

    const forced = await createAssistant('Forçada', {
      isFixed: true,
      servesBridal: true,
      categoryIds: [w.categoryId],
    });
    expect(forced).toMatchObject({
      isProfessional: true,
      isBridalAssistant: true,
      isFixed: false,
      servesBridal: false,
      categories: [],
    });
  });

  it('createMember PROFESSIONAL sem e-mail é recusado', async () => {
    const res = await adm()(CREATE, {
      i: input('Sem email', {
        roleName: 'PROFESSIONAL',
        categoryIds: [w.categoryId],
        temporaryPassword: 'Prov1sorio-Senha',
      }),
    });
    expect(res.data.createMember.member).toBeNull();
    expect(res.data.createMember.errors[0]).toMatchObject({ code: 'INVALID_EMAIL' });
  });

  it('assistente aparece em bridalAssistantCandidates', async () => {
    const m = await createAssistant('Candidata');
    const g = await insertStudioBrideGroup(w, { eventDate: localDay(30) });
    const res = await adm()(CANDIDATES, { g: g.groupId });
    expect(res.errors).toBeUndefined();
    const found = (res.data.bridalAssistantCandidates as { memberId: string; available: boolean }[]).find(
      (c) => c.memberId === m.id,
    );
    expect(found).toBeDefined();
    expect(found!.available).toBe(true);
  });

  it('updateMember PROFESSIONAL -> ASSISTANT zera fixa/atende noiva/categorias; atendimento futuro bloqueia', async () => {
    const created = await adm()(CREATE, {
      i: input('Troca', {
        email: `${PREFIX}-troca@teste.com`,
        roleName: 'PROFESSIONAL',
        isFixed: true,
        servesBridal: true,
        categoryIds: [w.categoryId],
        temporaryPassword: 'Prov1sorio-Senha',
      }),
    });
    expect(created.data.createMember.errors).toEqual([]);
    const id = created.data.createMember.member.id as string;

    const start = Date.now() + 10 * 86_400_000;
    const appt = await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: id,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: new Date(start),
        endsAt: new Date(start + 3_600_000),
        status: 'scheduled',
      },
    });

    const blocked = await adm()(UPDATE, { i: { id, roleName: 'ASSISTANT' } });
    expect(blocked.data.updateMember.member).toBeNull();
    expect(blocked.data.updateMember.errors[0]).toMatchObject({
      code: 'MEMBER_HAS_FUTURE_APPOINTMENTS',
      field: 'roleName',
    });
    const unchanged = await adminPrisma.member.findUniqueOrThrow({
      where: { id },
      include: { role: { select: { name: true } } },
    });
    expect(unchanged.role.name).toBe('PROFESSIONAL');
    expect(unchanged.isFixed).toBe(true);

    await adminPrisma.appointment.delete({ where: { id: appt.id } });
    const ok = await adm()(UPDATE, { i: { id, roleName: 'ASSISTANT' } });
    expect(ok.data.updateMember.errors).toEqual([]);
    expect(ok.data.updateMember.member).toMatchObject({
      roleName: 'ASSISTANT',
      isProfessional: true,
      isBridalAssistant: true,
      isFixed: false,
      servesBridal: false,
      categories: [],
    });
  });

  it('login de quem só é assistente é recusado; reset de senha também', async () => {
    const m = await createAssistant('Login');
    const hash = await new PasswordService().hash('Senha-Conhecida-1');
    await adminPrisma.$executeRawUnsafe(
      `UPDATE users SET password_hash = '${hash}' WHERE email = '${m.email}'`,
    );
    const res = await request(w.app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({ query: LOGIN, variables: { i: { email: m.email, password: 'Senha-Conhecida-1' } } });
    expect(res.body.data.login.accessToken).toBeNull();
    expect(res.body.data.login.errors[0].code).toBe('ASSISTANT_NO_LOGIN');

    const reset = await adm()(RESET, { i: { id: m.id } });
    expect(reset.data.resetMemberPassword.temporaryPassword).toBeNull();
    expect(reset.data.resetMemberPassword.errors[0].code).toBe('ASSISTANT_NO_LOGIN');
  });

  it('Perfis de acesso recusam assistente', async () => {
    const m = await createAssistant('Acessos');
    const res = await adm()(SET_ACCESS, {
      i: { memberId: m.id, changes: [{ itemId: 'fin-controle', enabled: true }] },
    });
    expect(res.data.setMemberAccess.errors[0].code).toBe('ACCESS_TARGET_ASSISTANT');
  });

  it('RLS: outra organização não enxerga o assistente', async () => {
    const m = await createAssistant('Isolada');
    const own = await adm()(ALL);
    expect((own.data.allMembers as { id: string }[]).some((x) => x.id === m.id)).toBe(true);
    const other = await gqlAs(w, w.tokens.otherAdmin)(ALL);
    expect((other.data.allMembers as { id: string }[]).some((x) => x.id === m.id)).toBe(false);
  });
});
