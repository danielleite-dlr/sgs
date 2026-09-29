import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { adminPrisma } from './setup';
import { TestEmailAdapter } from '../../src/email/test-email.adapter';
import { EMAIL_ADAPTER } from '../../src/email/email.module';

/**
 * Regra "profissional atende a categoria": professionalsForService e a
 * recusa PROFESSIONAL_DOES_NOT_SERVE_CATEGORY no createAppointment.
 * Arvore: Cabelo > Penteados ; Maquiagem. Prefixo 'procat-'.
 *
 * Running: pnpm test:integration -- --testPathPattern professional-categories.e2e.spec
 */
describe('Professional categories (agenda)', () => {
  let app: INestApplication;
  let orgId: string;
  let otherOrgId: string;
  let adminToken: string;

  let proAId: string; // Cabelo
  let proBId: string; // Maquiagem
  let proCId: string; // sem vinculos
  let proDId: string; // inativo, Cabelo
  let attendantMemberId: string;
  let serviceId: string; // em Penteados
  let otherOrgServiceId: string;
  let clientId: string;

  const stamp = Date.now();

  const gql = async (query: string, variables?: Record<string, unknown>) => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ query, variables });
    return res.body as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: Record<string, any>;
      errors?: { message: string }[];
    };
  };

  const cleanup = async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'procat-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM clients WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'procat-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM services WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'procat-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE display_name LIKE 'procat-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'procat-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM users WHERE email LIKE 'procat-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM categories WHERE organization_id IN (SELECT id FROM organizations WHERE legal_name LIKE 'procat-%')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'procat-%'`,
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
      (await adminPrisma.role.findMany({ where: { isSystem: true } })).map(
        (r) => [r.name, r.id],
      ),
    );

    const mkOrg = (tag: string, fill: string, offset: number) =>
      adminPrisma.organization.create({
        data: {
          legalName: `procat-org-${tag}`,
          tradeName: `procat-${tag}`,
          documentType: 'CNPJ',
          documentNumber: `${stamp + offset}`.slice(0, 14).padEnd(14, fill),
          email: `procat-${tag}@t.com`,
          subdomain: `procat-${tag}-${stamp}`,
          segment: 'salon',
        },
      });
    orgId = (await mkOrg('a', '3', 0)).id;
    otherOrgId = (await mkOrg('b', '4', 1)).id;

    const cabelo = await adminPrisma.category.create({
      data: { organizationId: orgId, name: 'procat-Cabelo' },
    });
    const penteados = await adminPrisma.category.create({
      data: { organizationId: orgId, name: 'procat-Penteados', parentId: cabelo.id },
    });
    const maquiagem = await adminPrisma.category.create({
      data: { organizationId: orgId, name: 'procat-Maquiagem' },
    });
    const otherCat = await adminPrisma.category.create({
      data: { organizationId: otherOrgId, name: 'procat-Other' },
    });

    serviceId = (
      await adminPrisma.service.create({
        data: {
          organizationId: orgId,
          categoryId: penteados.id,
          name: 'procat-penteado',
          basePrice: '80.00',
          defaultDurationMinutes: 60,
        },
      })
    ).id;
    otherOrgServiceId = (
      await adminPrisma.service.create({
        data: {
          organizationId: otherOrgId,
          categoryId: otherCat.id,
          name: 'procat-other-svc',
          basePrice: '10.00',
          defaultDurationMinutes: 30,
        },
      })
    ).id;
    clientId = (
      await adminPrisma.client.create({
        data: { organizationId: orgId, fullName: 'procat-client', phone: '+5511988880001' },
      })
    ).id;

    const argon2 = await import('argon2');
    const pwHash = await argon2.hash('password1234', { type: argon2.argon2id });
    const mk = async (
      tag: string,
      role: string,
      opts: { pro: boolean; status?: string; cats?: string[] },
    ) => {
      const user = await adminPrisma.user.create({
        data: {
          email: `procat-${tag}-${stamp}@t.com`,
          fullName: `procat ${tag}`,
          passwordHash: pwHash,
          emailVerifiedAt: new Date(),
        },
      });
      const member = await adminPrisma.member.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          roleId: roles[role],
          displayName: `procat-${tag}`,
          status: opts.status ?? 'active',
          isProfessional: opts.pro,
        },
      });
      for (const categoryId of opts.cats ?? []) {
        await adminPrisma.memberCategory.create({
          data: { organizationId: orgId, memberId: member.id, categoryId },
        });
      }
      return { user, member };
    };

    const admin = await mk('admin', 'ADMIN', { pro: false });
    proAId = (await mk('pro-a', 'PROFESSIONAL', { pro: true, cats: [cabelo.id] })).member.id;
    proBId = (await mk('pro-b', 'PROFESSIONAL', { pro: true, cats: [maquiagem.id] })).member.id;
    proCId = (await mk('pro-c', 'PROFESSIONAL', { pro: true })).member.id;
    proDId = (
      await mk('pro-d', 'PROFESSIONAL', { pro: true, status: 'inactive', cats: [cabelo.id] })
    ).member.id;
    attendantMemberId = (await mk('att', 'ATTENDANT', { pro: false })).member.id;

    const login = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `mutation($i: LoginInput!) { login(input: $i) { accessToken } }`,
        variables: { i: { email: admin.user.email, password: 'password1234' } },
      });
    adminToken = login.body.data.login.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  const FOR_SERVICE = `query($s: UUID!) { professionalsForService(serviceId: $s) { id displayName } }`;

  it('professionalsForService devolve só ativos que atendem (A e C)', async () => {
    const res = await gql(FOR_SERVICE, { s: serviceId });
    const ids = (res.data!.professionalsForService as { id: string }[]).map((m) => m.id);
    expect(ids.sort()).toEqual([proAId, proCId].sort());
    expect(ids).not.toContain(proBId);
    expect(ids).not.toContain(proDId);
    expect(ids).not.toContain(attendantMemberId);
  });

  it('serviço inexistente ou de outra organização devolve lista vazia', async () => {
    const other = await gql(FOR_SERVICE, { s: otherOrgServiceId });
    expect(other.data!.professionalsForService).toEqual([]);
    const missing = await gql(FOR_SERVICE, {
      s: '00000000-0000-4000-8000-000000000000',
    });
    expect(missing.data!.professionalsForService).toEqual([]);
  });

  const CREATE = `mutation($i: CreateAppointmentInput!) { createAppointment(input: $i) {
    appointment { id professionalId } errors { code field } } }`;

  const slot = (hourOffset: number) => {
    const start = new Date(Date.UTC(2031, 0, 10, 12 + hourOffset));
    return {
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 3600_000).toISOString(),
    };
  };

  it('createAppointment recusa profissional que não atende a categoria', async () => {
    const res = await gql(CREATE, {
      i: { professionalId: proBId, clientId, serviceId, ...slot(0) },
    });
    expect(res.data!.createAppointment.appointment).toBeNull();
    expect(res.data!.createAppointment.errors[0]).toEqual({
      code: 'PROFESSIONAL_DOES_NOT_SERVE_CATEGORY',
      field: 'professionalId',
    });
  });

  it('createAppointment aceita quem atende (A) e quem não tem vínculos (C)', async () => {
    const a = await gql(CREATE, {
      i: { professionalId: proAId, clientId, serviceId, ...slot(0) },
    });
    expect(a.data!.createAppointment.errors).toEqual([]);
    expect(a.data!.createAppointment.appointment.professionalId).toBe(proAId);

    const c = await gql(CREATE, {
      i: { professionalId: proCId, clientId, serviceId, ...slot(2) },
    });
    expect(c.data!.createAppointment.errors).toEqual([]);
  });
});
