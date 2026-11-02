import { adminPrisma, appPrisma } from './setup';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../src/authz/permissions.catalog';
import { deletePhase3Rows } from './helpers/phase3-cleanup';

const PHASE3_TABLES = [
  'time_blocks',
  'comandas',
  'comanda_sequences',
  'comanda_items',
  'comanda_payments',
  'client_credit_movements',
  'cash_movements',
  'commission_records',
  'audit_log',
];

const PHASE3_PREFIXES = ['comanda.', 'credit.', 'financial.', 'commissionRecord.'];
const FILTER = "SELECT id FROM organizations WHERE legal_name LIKE 'p3smoke-%'";

describe('Phase 3 schema smoke', () => {
  let orgId: string;
  let memberId: string;
  let clientId: string;
  let serviceId: string;

  const cleanup = async () => {
    await deletePhase3Rows(FILTER);
    for (const t of ['appointments', 'clients', 'services', 'categories']) {
      await adminPrisma.$executeRawUnsafe(
        `DELETE FROM ${t} WHERE organization_id IN (${FILTER})`,
      );
    }
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM members WHERE organization_id IN (${FILTER})`,
    );
    await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'p3smoke-%'`);
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM organizations WHERE legal_name LIKE 'p3smoke-%'`,
    );
  };

  beforeAll(async () => {
    await cleanup();
    const stamp = Date.now();
    const role = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });
    orgId = (
      await adminPrisma.organization.create({
        data: {
          legalName: 'p3smoke-org',
          tradeName: 'p3smoke',
          documentType: 'CNPJ',
          documentNumber: `${stamp}`.slice(0, 14).padEnd(14, '5'),
          email: 'p3smoke@t.com',
          subdomain: `p3smoke-${stamp}`,
          segment: 'salon',
        },
      })
    ).id;
    const user = await adminPrisma.user.create({
      data: {
        email: `p3smoke-${stamp}@t.com`,
        fullName: 'p3smoke',
        passwordHash: 'x',
      },
    });
    memberId = (
      await adminPrisma.member.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          roleId: role.id,
          displayName: 'p3smoke-pro',
          isProfessional: true,
        },
      })
    ).id;
    clientId = (
      await adminPrisma.client.create({
        data: { organizationId: orgId, fullName: 'p3smoke-client', phone: '+5511988880002' },
      })
    ).id;
    const cat = await adminPrisma.category.create({
      data: { organizationId: orgId, name: 'p3smoke-cat' },
    });
    serviceId = (
      await adminPrisma.service.create({
        data: {
          organizationId: orgId,
          categoryId: cat.id,
          name: 'p3smoke-svc',
          basePrice: '10.00',
          defaultDurationMinutes: 60,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('as 9 tabelas novas tem FORCE ROW LEVEL SECURITY', async () => {
    const rows = await adminPrisma.$queryRawUnsafe<{ relname: string; f: boolean }[]>(
      `SELECT relname, relforcerowsecurity AS f FROM pg_class WHERE relname = ANY($1::text[])`,
      PHASE3_TABLES,
    );
    expect(rows).toHaveLength(PHASE3_TABLES.length);
    for (const r of rows) expect(r.f).toBe(true);
  });

  it('a exclusion constraint cobre in_progress e completed', async () => {
    const rows = await adminPrisma.$queryRawUnsafe<{ def: string }[]>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ex_appointments_professional_interval'`,
    );
    expect(rows[0].def).toContain('in_progress');
    expect(rows[0].def).toContain('completed');
  });

  it('rejeita sobreposicao com agendamento in_progress (23P01)', async () => {
    const mk = (status: string, start: string, end: string) =>
      adminPrisma.appointment.create({
        data: {
          organizationId: orgId,
          professionalId: memberId,
          clientId,
          serviceId,
          status,
          startsAt: new Date(start),
          endsAt: new Date(end),
        },
      });
    await mk('in_progress', '2031-03-01T10:00:00Z', '2031-03-01T11:00:00Z');
    await expect(mk('scheduled', '2031-03-01T10:30:00Z', '2031-03-01T11:30:00Z')).rejects.toThrow(
      /ex_appointments_professional_interval/,
    );
  });

  it('sgs_app nao faz UPDATE/DELETE nos ledgers, mas faz INSERT', async () => {
    for (const t of ['commission_records', 'audit_log', 'cash_movements', 'client_credit_movements']) {
      const r = await adminPrisma.$queryRawUnsafe<{ u: boolean; d: boolean; i: boolean }[]>(
        `SELECT has_table_privilege('sgs_app', '${t}', 'UPDATE') AS u,
                has_table_privilege('sgs_app', '${t}', 'DELETE') AS d,
                has_table_privilege('sgs_app', '${t}', 'INSERT') AS i`,
      );
      expect({ t, ...r[0] }).toEqual({ t, u: false, d: false, i: true });
    }
  });

  it('permissoes da Fase 3 no banco == catalogo TS, por papel', async () => {
    expect(PERMISSIONS.COMANDA_REOPEN).toBe('comanda.reopen');
    for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
      const expected = perms.filter((p) => PHASE3_PREFIXES.some((x) => p.startsWith(x))).sort();
      const rows = await adminPrisma.$queryRawUnsafe<{ permission: string }[]>(
        `SELECT rp.permission FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
          WHERE r.name = $1 AND r.is_system = true`,
        roleName,
      );
      const actual = rows
        .map((r) => r.permission)
        .filter((p) => PHASE3_PREFIXES.some((x) => p.startsWith(x)))
        .sort();
      expect({ roleName, actual }).toEqual({ roleName, actual: expected });
    }
  });

  it('os delegates Prisma das tabelas novas existem', () => {
    const c = appPrisma as unknown as Record<string, { findMany: unknown }>;
    for (const d of [
      'comanda',
      'comandaItem',
      'comandaPayment',
      'commissionRecord',
      'cashMovement',
      'clientCreditMovement',
      'timeBlock',
      'auditLog',
      'comandaSequence',
    ]) {
      expect(typeof c[d].findMany).toBe('function');
    }
  });
});
