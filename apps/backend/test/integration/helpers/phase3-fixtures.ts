import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { createFastifyAdapter } from '../../../src/http/fastify-adapter';
import { adminPrisma } from '../setup';
import { TestEmailAdapter } from '../../../src/email/test-email.adapter';
import { EMAIL_ADAPTER } from '../../../src/email/email.module';
import { deletePhase3Rows } from './phase3-cleanup';
import { ANTHROPIC_CLIENT, type AnthropicLike } from '../../../src/bridal/ai/anthropic-client';

export interface Phase3World {
  app: INestApplication;
  orgId: string;
  otherOrgId: string;
  prefix: string;
  members: { admin: string; manager: string; attendant: string; proA: string; proB: string };
  tokens: {
    admin: string;
    manager: string;
    attendant: string;
    proA: string;
    proB: string;
    otherAdmin: string;
  };
  clientId: string;
  categoryId: string;
  childCategoryId: string;
  /** base_price "100.00", 60 min, na childCategory */
  serviceId: string;
  /** base_price "50.00", 30 min, na childCategory */
  serviceBId: string;
  /** variante "Senior" de serviceId, price "120.00", seniority_tier 'senior' */
  variantId: string;
  /** sale_price "35.00", stock_quantity 10, min_stock_level 2 */
  productId: string;
  /** price "135.00" com serviceId (qty 1) + serviceBId (qty 1) */
  packageId: string;
}

type GqlResult = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors?: { message: string; extensions?: any }[];
};

export function gqlAs(
  w: Phase3World,
  token: string,
): (query: string, variables?: Record<string, unknown>) => Promise<GqlResult> {
  return async (query, variables) => {
    const res = await request(w.app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .send({ query, variables });
    return res.body as GqlResult;
  };
}

const orgFilter = (prefix: string) =>
  `SELECT id FROM organizations WHERE legal_name LIKE '${prefix}-%'`;

async function cleanupRows(prefix: string): Promise<void> {
  const f = orgFilter(prefix);
  await deletePhase3Rows(f);
  const del = (table: string) =>
    adminPrisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE organization_id IN (${f})`);
  await del('appointments');
  await del('clients');
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM package_services WHERE package_id IN (SELECT id FROM packages WHERE organization_id IN (${f}))`,
  );
  await del('packages');
  await del('commission_rules');
  await del('service_pricing_variants');
  await del('services');
  await del('stock_movements');
  await del('notifications');
  await del('products');
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM member_categories WHERE organization_id IN (${f})`,
  );
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '${prefix}-%')`,
  );
  await del('members');
  await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE '${prefix}-%'`);
  await del('categories');
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM organizations WHERE legal_name LIKE '${prefix}-%'`,
  );
}

/**
 * Cria o "mundo" padrao das suites da Fase 3: app Nest, 2 organizacoes,
 * membros por papel (senha password1234), tokens, cliente e catalogo.
 * Nao cria regras de comissao (cada suite cria as suas).
 */
export async function createPhase3World(
  prefix: string,
  opts: { anthropicClient?: AnthropicLike | null } = {},
): Promise<Phase3World> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EMAIL_ADAPTER)
    .useClass(TestEmailAdapter)
    .overrideProvider(ANTHROPIC_CLIENT)
    .useValue(opts.anthropicClient ?? null)
    .compile();
  const app = moduleRef.createNestApplication(createFastifyAdapter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  await cleanupRows(prefix);

  const stamp = Date.now();
  const roles = Object.fromEntries(
    (await adminPrisma.role.findMany({ where: { isSystem: true } })).map((r) => [r.name, r.id]),
  );

  const mkOrg = (tag: string, fill: string, offset: number) =>
    adminPrisma.organization.create({
      data: {
        legalName: `${prefix}-org-${tag}`,
        tradeName: `${prefix}-${tag}`,
        documentType: 'CNPJ',
        documentNumber: `${stamp + offset}`.slice(0, 14).padEnd(14, fill),
        email: `${prefix}-${tag}@t.com`,
        subdomain: `${prefix}-${tag}-${stamp}`,
        segment: 'salon',
      },
    });
  const orgId = (await mkOrg('a', '3', 0)).id;
  const otherOrgId = (await mkOrg('b', '4', 1)).id;

  const categoryId = (
    await adminPrisma.category.create({
      data: { organizationId: orgId, name: `${prefix}-Cabelo` },
    })
  ).id;
  const childCategoryId = (
    await adminPrisma.category.create({
      data: { organizationId: orgId, name: `${prefix}-Penteados`, parentId: categoryId },
    })
  ).id;

  const mkService = (name: string, price: string, minutes: number) =>
    adminPrisma.service.create({
      data: {
        organizationId: orgId,
        categoryId: childCategoryId,
        name: `${prefix}-${name}`,
        basePrice: price,
        defaultDurationMinutes: minutes,
      },
    });
  const serviceId = (await mkService('servico-a', '100.00', 60)).id;
  const serviceBId = (await mkService('servico-b', '50.00', 30)).id;
  const variantId = (
    await adminPrisma.servicePricingVariant.create({
      data: {
        organizationId: orgId,
        serviceId,
        name: 'Senior',
        durationMinutes: 60,
        seniorityTier: 'senior',
        price: '120.00',
      },
    })
  ).id;
  const productId = (
    await adminPrisma.product.create({
      data: {
        organizationId: orgId,
        name: `${prefix}-produto`,
        sku: `${prefix}-sku-${stamp}`,
        salePrice: '35.00',
        stockQuantity: 10,
        minStockLevel: 2,
        unit: 'un',
      },
    })
  ).id;
  const packageId = (
    await adminPrisma.package.create({
      data: {
        organizationId: orgId,
        name: `${prefix}-pacote`,
        price: '135.00',
        services: {
          create: [
            { serviceId, quantity: 1, displayOrder: 0 },
            { serviceId: serviceBId, quantity: 1, displayOrder: 1 },
          ],
        },
      },
    })
  ).id;
  const clientId = (
    await adminPrisma.client.create({
      data: { organizationId: orgId, fullName: `${prefix}-cliente`, phone: '+5511988880001' },
    })
  ).id;

  const argon2 = await import('argon2');
  const pwHash = await argon2.hash('password1234', { type: argon2.argon2id });
  const mk = async (
    tag: string,
    role: string,
    opts: { org?: string; pro?: boolean; tier?: string },
  ) => {
    const user = await adminPrisma.user.create({
      data: {
        email: `${prefix}-${tag}-${stamp}@t.com`,
        fullName: `${prefix} ${tag}`,
        passwordHash: pwHash,
        emailVerifiedAt: new Date(),
      },
    });
    const member = await adminPrisma.member.create({
      data: {
        organizationId: opts.org ?? orgId,
        userId: user.id,
        roleId: roles[role],
        displayName: `${prefix}-${tag}`,
        isProfessional: opts.pro ?? false,
        seniorityTier: opts.tier ?? null,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({
        query: `mutation($i: LoginInput!) { login(input: $i) { accessToken } }`,
        variables: { i: { email: user.email, password: 'password1234' } },
      });
    const token = login.body?.data?.login?.accessToken as string;
    if (!token) throw new Error(`login failed for ${tag}: ${JSON.stringify(login.body)}`);
    return { memberId: member.id, token };
  };

  const admin = await mk('admin', 'ADMIN', {});
  const manager = await mk('manager', 'MANAGER', {});
  const attendant = await mk('attendant', 'ATTENDANT', {});
  const proA = await mk('pro-a', 'PROFESSIONAL', { pro: true, tier: 'senior' });
  const proB = await mk('pro-b', 'PROFESSIONAL', { pro: true });
  const otherAdmin = await mk('other-admin', 'ADMIN', { org: otherOrgId });

  return {
    app,
    orgId,
    otherOrgId,
    prefix,
    members: {
      admin: admin.memberId,
      manager: manager.memberId,
      attendant: attendant.memberId,
      proA: proA.memberId,
      proB: proB.memberId,
    },
    tokens: {
      admin: admin.token,
      manager: manager.token,
      attendant: attendant.token,
      proA: proA.token,
      proB: proB.token,
      otherAdmin: otherAdmin.token,
    },
    clientId,
    categoryId,
    childCategoryId,
    serviceId,
    serviceBId,
    variantId,
    productId,
    packageId,
  };
}

export async function destroyPhase3World(w: Phase3World): Promise<void> {
  await w.app.close();
  await cleanupRows(w.prefix);
}
