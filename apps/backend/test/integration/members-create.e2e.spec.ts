import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { adminPrisma, appPrisma } from './setup';
import { TestEmailAdapter } from '../../src/email/test-email.adapter';
import { EMAIL_ADAPTER } from '../../src/email/email.module';

/**
 * Cadastro direto de membro (createMember), reset de senha provisória
 * (resetMemberPassword), updateMember estendido e privacidade dos dados
 * pessoais. Prefixo 'memcr-' em tudo o que a suite cria.
 *
 * Running: pnpm test:integration -- --testPathPattern members-create.e2e.spec
 */
describe('Member direct registration (EQUIPE-01..03)', () => {
  let app: INestApplication;

  let orgAId: string;
  let orgBId: string;
  let catAId: string;
  let catA2Id: string;
  let catBId: string;

  let adminAToken: string;
  let managerAToken: string;
  let proAToken: string;
  let adminBToken: string;
  let adminAMemberId: string;

  let bOnlyEmail: string;
  const stamp = Date.now();
  const em = (tag: string) => `memcr-${tag}-${stamp}@t.com`;
  const PHONE = '(11) 98765-4321';
  const PIX = '123.456.789-09';

  const gql = async (
    token: string | null,
    query: string,
    variables?: Record<string, unknown>,
  ) => {
    const req = request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json');
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req.send({ query, variables });
    return res.body as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: Record<string, any>;
      errors?: { message: string }[];
    };
  };

  const CREATE = `mutation($i: CreateMemberInput!) { createMember(input: $i) {
    existingAccount warning
    member { id displayName email roleName isProfessional phone pixKey birthDate status categories { id name } }
    errors { code message field } } }`;

  const RESET = `mutation($i: ResetMemberPasswordInput!) { resetMemberPassword(input: $i) {
    temporaryPassword member { id } errors { code message field } } }`;

  const UPDATE = `mutation($i: UpdateMemberInput!) { updateMember(input: $i) {
    member { id roleName isProfessional phone pixKey birthDate categories { id name } }
    errors { code message field } } }`;

  const LOGIN = `mutation($i: LoginInput!) { login(input: $i) {
    accessToken errors { code }
    session { mustChangePassword memberships { organizationId roleName } } } }`;

  const login = async (email: string, password: string) => {
    const res = await gql(null, LOGIN, { i: { email, password } });
    return res.data!.login as {
      accessToken: string | null;
      errors: { code: string }[];
      session: {
        mustChangePassword: boolean;
        memberships: { organizationId: string; roleName: string }[];
      } | null;
    };
  };

  const baseInput = (tag: string, extra: Record<string, unknown> = {}) => ({
    displayName: `memcr-${tag}`,
    email: em(tag),
    phone: PHONE,
    pixKey: PIX,
    roleName: 'PROFESSIONAL',
    categoryIds: [catAId],
    temporaryPassword: 'Prov1sorio-Senha',
    ...extra,
  });

  const cleanup = async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'memcr-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'memcr-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'memcr-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'memcr-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'memcr-%'`,
    );
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_ADAPTER)
      .useClass(TestEmailAdapter)
      .compile();
    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    await cleanup();

    const roles = Object.fromEntries(
      (
        await adminPrisma.role.findMany({ where: { isSystem: true } })
      ).map((r) => [r.name, r.id]),
    );

    const mkOrg = (tag: string, fill: string) =>
      adminPrisma.organization.create({
        data: {
          legalName: `memcr-org-${tag}`,
          tradeName: `memcr-${tag}`,
          documentType: 'CNPJ',
          documentNumber: `${stamp + (tag === 'B' ? 1 : 0)}`
            .slice(0, 14)
            .padEnd(14, fill),
          email: `memcr-${tag.toLowerCase()}@t.com`,
          subdomain: `memcr-${tag.toLowerCase()}-${stamp}`,
          segment: 'salon',
        },
      });
    const [orgA, orgB] = [await mkOrg('A', '7'), await mkOrg('B', '8')];
    orgAId = orgA.id;
    orgBId = orgB.id;

    catAId = (
      await adminPrisma.category.create({
        data: { organizationId: orgAId, name: 'memcr-Cabelo' },
      })
    ).id;
    catA2Id = (
      await adminPrisma.category.create({
        data: { organizationId: orgAId, name: 'memcr-Maquiagem' },
      })
    ).id;
    catBId = (
      await adminPrisma.category.create({
        data: { organizationId: orgBId, name: 'memcr-CatB' },
      })
    ).id;

    const argon2 = await import('argon2');
    const pwHash = await argon2.hash('password1234', { type: argon2.argon2id });
    const mkUser = (tag: string) =>
      adminPrisma.user.create({
        data: {
          email: em(tag),
          fullName: `memcr ${tag}`,
          passwordHash: pwHash,
          emailVerifiedAt: new Date(),
        },
      });
    const [uAdminA, uManagerA, uProA, uAdminB, uBOnly] = await Promise.all([
      mkUser('admin-a'),
      mkUser('manager-a'),
      mkUser('pro-a'),
      mkUser('admin-b'),
      mkUser('b-only'),
    ]);
    bOnlyEmail = uBOnly.email;

    const mkMember = (
      orgId: string,
      userId: string,
      role: string,
      name: string,
    ) =>
      adminPrisma.member.create({
        data: {
          organizationId: orgId,
          userId,
          roleId: roles[role],
          displayName: `memcr-${name}`,
          status: 'active',
        },
      });
    adminAMemberId = (await mkMember(orgAId, uAdminA.id, 'ADMIN', 'admin-a')).id;
    await mkMember(orgAId, uManagerA.id, 'MANAGER', 'manager-a');
    await mkMember(orgAId, uProA.id, 'PROFESSIONAL', 'pro-a');
    await mkMember(orgBId, uAdminB.id, 'ADMIN', 'admin-b');
    await mkMember(orgBId, uBOnly.id, 'PROFESSIONAL', 'b-only');

    adminAToken = (await login(uAdminA.email, 'password1234')).accessToken!;
    managerAToken = (await login(uManagerA.email, 'password1234')).accessToken!;
    proAToken = (await login(uProA.email, 'password1234')).accessToken!;
    adminBToken = (await login(uAdminB.email, 'password1234')).accessToken!;
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  describe('createMember', () => {
    it('cria profissional (isProfessional forçado), normaliza contato e exige troca de senha', async () => {
      const res = await gql(
        adminAToken,
        CREATE,
        {
          i: baseInput('novo', {
            isProfessional: false,
            birthDate: '1990-05-20T00:00:00.000Z',
          }),
        },
      );
      const p = res.data!.createMember;
      expect(p.errors).toEqual([]);
      expect(p.existingAccount).toBe(false);
      expect(p.warning).toBeNull();
      expect(p.member.isProfessional).toBe(true);
      expect(p.member.phone).toBe('+5511987654321');
      expect(p.member.pixKey).toBe('12345678909');
      expect(p.member.birthDate).toBe('1990-05-20T00:00:00.000Z');
      expect(p.member.categories).toEqual([
        { id: catAId, name: 'memcr-Cabelo' },
      ]);

      const user = await adminPrisma.user.findUniqueOrThrow({
        where: { email: em('novo') },
      });
      expect(user.mustChangePassword).toBe(true);
      expect(user.fullName).toBe('memcr-novo');
      expect(user.passwordHash).not.toContain('Prov1sorio-Senha');
    });

    it('login com a senha provisória exige troca; depois de trocar, não exige mais', async () => {
      const first = await login(em('novo'), 'Prov1sorio-Senha');
      expect(first.errors).toEqual([]);
      expect(first.session!.mustChangePassword).toBe(true);
      expect(
        first.session!.memberships.map((m) => m.organizationId),
      ).toEqual([orgAId]);

      const change = await gql(
        first.accessToken,
        `mutation($i: ChangePasswordInput!) { changePassword(input: $i) { success errors { code } } }`,
        { i: { currentPassword: 'Prov1sorio-Senha', newPassword: 'NovaSenha-123' } },
      );
      expect(change.data!.changePassword.success).toBe(true);

      const second = await login(em('novo'), 'NovaSenha-123');
      expect(second.session!.mustChangePassword).toBe(false);
    });

    it.each([
      ['INVALID_PHONE', 'phone', { phone: '123' }],
      ['INVALID_PIX_KEY', 'pixKey', { pixKey: 'abc' }],
      ['WEAK_PASSWORD', 'temporaryPassword', { temporaryPassword: '1234567' }],
      ['CATEGORY_REQUIRED', 'categoryIds', { categoryIds: [] }],
      ['CATEGORY_NOT_FOUND', 'categoryIds', { categoryIds: ['CAT_B'] }],
      ['INVALID_NAME', 'displayName', { displayName: 'x' }],
    ])('recusa com %s', async (code, field, override) => {
      const patched = JSON.parse(
        JSON.stringify(override).replace('CAT_B', catBId),
      );
      const res = await gql(adminAToken, CREATE, {
        i: baseInput(`err-${code.toLowerCase()}`, patched),
      });
      expect(res.data!.createMember.member).toBeNull();
      expect(res.data!.createMember.errors[0]).toMatchObject({ code, field });
    });

    it('MANAGER cria ATTENDANT, mas não ADMIN', async () => {
      const ok = await gql(managerAToken, CREATE, {
        i: baseInput('att', { roleName: 'ATTENDANT', categoryIds: undefined }),
      });
      expect(ok.data!.createMember.errors).toEqual([]);
      expect(ok.data!.createMember.member.isProfessional).toBe(false);
      expect(ok.data!.createMember.member.categories).toEqual([]);

      const bad = await gql(managerAToken, CREATE, {
        i: baseInput('adm', { roleName: 'ADMIN', isProfessional: false }),
      });
      expect(bad.data!.createMember.errors[0]).toMatchObject({
        code: 'FORBIDDEN_ROLE',
        field: 'roleName',
      });
    });

    it('PROFESSIONAL não pode cadastrar', async () => {
      const res = await gql(proAToken, CREATE, { i: baseInput('proibido') });
      expect(res.errors?.length).toBeGreaterThan(0);
      expect(res.data?.createMember ?? null).toBeNull();
    });

    it('e-mail de conta existente cria só o member e não toca na senha', async () => {
      const before = await adminPrisma.user.findUniqueOrThrow({
        where: { email: bOnlyEmail },
      });
      const res = await gql(adminAToken, CREATE, {
        i: baseInput('reuse', {
          email: bOnlyEmail,
          temporaryPassword: 'OutraSenha-999',
        }),
      });
      const p = res.data!.createMember;
      expect(p.errors).toEqual([]);
      expect(p.existingAccount).toBe(true);
      expect(p.warning).toContain('já tem conta');

      const after = await adminPrisma.user.findUniqueOrThrow({
        where: { email: bOnlyEmail },
      });
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(after.mustChangePassword).toBe(before.mustChangePassword);

      const again = await gql(adminAToken, CREATE, {
        i: baseInput('reuse2', { email: bOnlyEmail }),
      });
      expect(again.data!.createMember.errors[0]).toMatchObject({
        code: 'MEMBER_ALREADY_EXISTS',
        field: 'email',
      });
      expect(again.data!.createMember.errors[0].message).toMatch(/inativa|removida/);
    });

    it('e-mail repetido na mesma organização retorna MEMBER_ALREADY_EXISTS', async () => {
      const res = await gql(adminAToken, CREATE, {
        i: baseInput('dup', { email: em('novo') }),
      });
      expect(res.data!.createMember.errors[0]).toMatchObject({
        code: 'MEMBER_ALREADY_EXISTS',
        field: 'email',
      });
    });
  });

  describe('resetMemberPassword', () => {
    let soloMemberId: string;
    let dualMemberId: string;

    beforeAll(async () => {
      const solo = await gql(adminAToken, CREATE, {
        i: baseInput('solo', { temporaryPassword: 'Solo-Senha-1' }),
      });
      soloMemberId = solo.data!.createMember.member.id;
      const dual = await adminPrisma.member.findFirstOrThrow({
        where: { organizationId: orgAId, displayName: 'memcr-reuse' },
      });
      dualMemberId = dual.id;
    });

    it('gera nova senha, revoga sessões e força troca', async () => {
      const first = await login(em('solo'), 'Solo-Senha-1');
      expect(first.errors).toEqual([]);
      const userId = (
        await adminPrisma.user.findUniqueOrThrow({ where: { email: em('solo') } })
      ).id;
      const activeBefore = await adminPrisma.refreshToken.count({
        where: { userId, revokedAt: null },
      });
      expect(activeBefore).toBeGreaterThan(0);

      const res = await gql(adminAToken, RESET, { i: { id: soloMemberId } });
      const p = res.data!.resetMemberPassword;
      expect(p.errors).toEqual([]);
      expect(p.temporaryPassword).toHaveLength(14);

      const user = await adminPrisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.mustChangePassword).toBe(true);
      const activeAfter = await adminPrisma.refreshToken.count({
        where: { userId, revokedAt: null },
      });
      expect(activeAfter).toBe(0);

      const old = await login(em('solo'), 'Solo-Senha-1');
      expect(old.accessToken).toBeNull();
      const fresh = await login(em('solo'), p.temporaryPassword);
      expect(fresh.errors).toEqual([]);
      expect(fresh.session!.mustChangePassword).toBe(true);
    });

    it('recusa membro que também é de outro salão', async () => {
      const res = await gql(adminAToken, RESET, { i: { id: dualMemberId } });
      expect(res.data!.resetMemberPassword.errors[0].code).toBe(
        'MEMBER_IN_OTHER_ORGANIZATION',
      );
      expect(res.data!.resetMemberPassword.temporaryPassword).toBeNull();
    });

    it('recusa reset de si mesmo', async () => {
      const res = await gql(adminAToken, RESET, { i: { id: adminAMemberId } });
      expect(res.data!.resetMemberPassword.errors[0].code).toBe('CANNOT_RESET_SELF');
    });

    it('MANAGER não tem permissão', async () => {
      const res = await gql(managerAToken, RESET, { i: { id: soloMemberId } });
      expect(res.errors?.length).toBeGreaterThan(0);
    });

    it('member de outra organização é MEMBER_NOT_FOUND', async () => {
      const res = await gql(adminBToken, RESET, { i: { id: soloMemberId } });
      expect(res.data!.resetMemberPassword.errors[0].code).toBe('MEMBER_NOT_FOUND');
    });
  });

  describe('updateMember estendido', () => {
    let targetId: string;

    beforeAll(async () => {
      const res = await gql(adminAToken, CREATE, {
        i: baseInput('upd', { categoryIds: [catAId] }),
      });
      targetId = res.data!.createMember.member.id;
    });

    it('altera contato, nascimento e substitui categorias', async () => {
      const res = await gql(adminAToken, UPDATE, {
        i: {
          id: targetId,
          phone: '11 3333-4444',
          pixKey: 'Foo@Bar.com',
          birthDate: '1985-01-02T00:00:00.000Z',
          categoryIds: [catA2Id],
        },
      });
      const m = res.data!.updateMember.member;
      expect(res.data!.updateMember.errors).toEqual([]);
      expect(m.phone).toBe('+551133334444');
      expect(m.pixKey).toBe('foo@bar.com');
      expect(m.birthDate).toBe('1985-01-02T00:00:00.000Z');
      expect(m.categories).toEqual([{ id: catA2Id, name: 'memcr-Maquiagem' }]);

      const cleared = await gql(adminAToken, UPDATE, {
        i: { id: targetId, birthDate: null, categoryIds: [] },
      });
      expect(cleared.data!.updateMember.member.birthDate).toBeNull();
      expect(cleared.data!.updateMember.member.categories).toEqual([]);
    });

    it('phone inválido -> INVALID_PHONE', async () => {
      const res = await gql(adminAToken, UPDATE, {
        i: { id: targetId, phone: '999' },
      });
      expect(res.data!.updateMember.errors[0]).toMatchObject({
        code: 'INVALID_PHONE',
        field: 'phone',
      });
    });

    it('papel PROFESSIONAL força isProfessional; sair do papel sem ser profissional apaga categorias', async () => {
      const att = await gql(adminAToken, CREATE, {
        i: baseInput('promo', { roleName: 'ATTENDANT', categoryIds: undefined }),
      });
      const id = att.data!.createMember.member.id;

      const toPro = await gql(adminAToken, UPDATE, {
        i: { id, roleName: 'PROFESSIONAL', isProfessional: false, categoryIds: [catAId] },
      });
      expect(toPro.data!.updateMember.member.isProfessional).toBe(true);
      expect(toPro.data!.updateMember.member.categories).toHaveLength(1);

      const off = await gql(adminAToken, UPDATE, {
        i: { id, roleName: 'ATTENDANT', isProfessional: false },
      });
      expect(off.data!.updateMember.member.isProfessional).toBe(false);
      expect(off.data!.updateMember.member.categories).toEqual([]);
      const links = await adminPrisma.memberCategory.count({ where: { memberId: id } });
      expect(links).toBe(0);
    });

    it('categoria de outra organização -> CATEGORY_NOT_FOUND', async () => {
      const res = await gql(adminAToken, UPDATE, {
        i: { id: targetId, categoryIds: [catBId] },
      });
      expect(res.data!.updateMember.errors[0]).toMatchObject({
        code: 'CATEGORY_NOT_FOUND',
        field: 'categoryIds',
      });
    });
  });

  describe('privacidade e RLS', () => {
    const LIST = `{ allMembers { displayName phone pixKey birthDate } members { displayName phone pixKey birthDate } }`;

    it('PROFESSIONAL não enxerga phone/pixKey/birthDate; ADMIN e MANAGER enxergam', async () => {
      const pro = await gql(proAToken, LIST);
      for (const m of [...pro.data!.allMembers, ...pro.data!.members]) {
        expect(m.phone).toBeNull();
        expect(m.pixKey).toBeNull();
        expect(m.birthDate).toBeNull();
      }
      for (const token of [adminAToken, managerAToken]) {
        const res = await gql(token, LIST);
        const novo = res.data!.allMembers.find(
          (m: { displayName: string }) => m.displayName === 'memcr-solo',
        );
        expect(novo.phone).toBe('+5511987654321');
        expect(novo.pixKey).toBe('12345678909');
      }
    });

    it('member_categories respeita RLS por organização', async () => {
      const seen = await appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.current_organization', '${orgBId}', true)`,
        );
        const rows = await tx.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT count(*) AS count FROM member_categories`,
        );
        return Number(rows[0].count);
      });
      expect(seen).toBe(0);

      const seenA = await appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.current_organization', '${orgAId}', true)`,
        );
        const rows = await tx.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT count(*) AS count FROM member_categories`,
        );
        return Number(rows[0].count);
      });
      expect(seenA).toBeGreaterThan(0);
    });
  });
});
