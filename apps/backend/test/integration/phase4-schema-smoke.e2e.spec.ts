import { createHash } from 'node:crypto';
import { adminPrisma, appPrisma } from './setup';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../src/authz/permissions.catalog';
import {
  createPhase4World,
  destroyPhase4World,
  insertBridalGroupRow,
  insertContractRow,
  insertLetterheadRow,
  type Phase4World,
} from './helpers/phase4-fixtures';

const PHASE4_TABLES = [
  'contract_settings',
  'bridal_groups',
  'bridal_group_members',
  'bridal_member_services',
  'contract_sequences',
  'contracts',
  'contract_items',
  'contract_versions',
  'contract_access_tokens',
  'contract_acceptances',
  'contract_payments',
  'ai_schedule_suggestions',
  'contract_alert_runs',
];

const PHASE4_PREFIXES = ['bridal.', 'contract.'];

const EXPECTED_MATRIX: Record<string, string[]> = {
  ADMIN: [
    'bridal.read',
    'bridal.write',
    'bridal.aiSuggest',
    'contract.read',
    'contract.write',
    'contract.payment',
    'contract.cancel',
    'contract.settings',
  ],
  MANAGER: [
    'bridal.read',
    'bridal.write',
    'bridal.aiSuggest',
    'contract.read',
    'contract.write',
    'contract.payment',
    'contract.cancel',
  ],
  ATTENDANT: ['bridal.read', 'bridal.write', 'contract.read', 'contract.payment'],
  PROFESSIONAL: [],
};

describe('Phase 4 schema smoke', () => {
  let w: Phase4World;

  beforeAll(async () => {
    w = await createPhase4World('p4smoke');
  });

  afterAll(async () => {
    await destroyPhase4World(w);
  });

  it('as 13 tabelas novas tem ROW LEVEL SECURITY habilitada e forcada', async () => {
    const rows = await adminPrisma.$queryRawUnsafe<{ relname: string; e: boolean; f: boolean }[]>(
      `SELECT relname, relrowsecurity AS e, relforcerowsecurity AS f
         FROM pg_class WHERE relname = ANY($1::text[]) AND relkind = 'r'`,
      PHASE4_TABLES,
    );
    expect(rows).toHaveLength(PHASE4_TABLES.length);
    for (const r of rows) expect({ t: r.relname, e: r.e, f: r.f }).toEqual({ t: r.relname, e: true, f: true });
  });

  it('sgs_app recebe permission denied em UPDATE e DELETE dos ledgers', async () => {
    const inTenant = async (sql: string) =>
      appPrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_organization', ${w.orgId}, true)`;
        return tx.$executeRawUnsafe(sql);
      });
    const nil = '00000000-0000-0000-0000-000000000000';
    await expect(
      inTenant(`UPDATE contract_payments SET note = 'x' WHERE id = '${nil}'`),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      inTenant(`DELETE FROM contract_acceptances WHERE id = '${nil}'`),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      inTenant(`UPDATE contract_versions SET rendered_text = 'x' WHERE id = '${nil}'`),
    ).rejects.toThrow(/permission denied/i);
    for (const t of ['contract_payments', 'contract_acceptances', 'contract_versions']) {
      const r = await adminPrisma.$queryRawUnsafe<{ u: boolean; d: boolean; i: boolean }[]>(
        `SELECT has_table_privilege('sgs_app', '${t}', 'UPDATE') AS u,
                has_table_privilege('sgs_app', '${t}', 'DELETE') AS d,
                has_table_privilege('sgs_app', '${t}', 'INSERT') AS i`,
      );
      expect({ t, ...r[0] }).toEqual({ t, u: false, d: false, i: true });
    }
  });

  it('permissoes da Fase 4 no banco == catalogo TS == matriz esperada, por papel', async () => {
    expect(PERMISSIONS.CONTRACT_SETTINGS).toBe('contract.settings');
    expect(ROLE_PERMISSIONS.MANAGER).not.toContain(PERMISSIONS.CONTRACT_SETTINGS);
    for (const [roleName, expected] of Object.entries(EXPECTED_MATRIX)) {
      const rows = await adminPrisma.$queryRawUnsafe<{ permission: string }[]>(
        `SELECT rp.permission FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
          WHERE r.name = $1 AND r.is_system = true`,
        roleName,
      );
      const inDb = rows
        .map((r) => r.permission)
        .filter((p) => PHASE4_PREFIXES.some((x) => p.startsWith(x)))
        .sort();
      const inCatalog = (ROLE_PERMISSIONS as Record<string, string[]>)[roleName]
        .filter((p) => PHASE4_PREFIXES.some((x) => p.startsWith(x)))
        .sort();
      expect({ roleName, inDb }).toEqual({ roleName, inDb: [...expected].sort() });
      expect({ roleName, inCatalog }).toEqual({ roleName, inCatalog: [...expected].sort() });
    }
  });

  it('time_blocks deslocamento exige bridal_group_id (chk_time_blocks_travel)', async () => {
    await expect(
      adminPrisma.$executeRawUnsafe(
        `INSERT INTO time_blocks (organization_id, professional_id, kind, starts_at, ends_at)
         VALUES ('${w.orgId}', '${w.members.proA}', 'deslocamento', '2030-06-15T08:00:00Z', '2030-06-15T09:00:00Z')`,
      ),
    ).rejects.toThrow(/chk_time_blocks_travel/);
  });

  it('segundo contrato vivo no mesmo grupo viola uq_contracts_group_live', async () => {
    const g = await insertBridalGroupRow(w, { companions: 1 });
    await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '500.00',
      depositAmount: '150.00',
    });
    await expect(
      insertContractRow(w, {
        groupId: g.groupId,
        brideClientId: g.brideClientId,
        totalAmount: '500.00',
        depositAmount: '150.00',
      }),
    ).rejects.toThrow(/unique|uq_contracts_group_live/i);
    // cancelado nao conta como vivo
    await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '500.00',
      depositAmount: '150.00',
      status: 'cancelled',
    });
  });

  it('o pacote de noiva da fixture tem sinal de 30%', async () => {
    const p = await adminPrisma.package.findUniqueOrThrow({ where: { id: w.bridalPackageId } });
    expect(p.depositKind).toBe('percent');
    expect(p.depositValue?.toString()).toBe('30');
  });

  describe('fase 04.1', () => {
    const EXPECTED_COLUMNS: Record<string, string[]> = {
      clients: ['rg', 'postal_code', 'phone2', 'phone3'],
      packages: ['contract_description'],
      bridal_groups: ['event_kind', 'responsible_client_id', 'event_time', 'location_name'],
      contracts: ['payment_mode', 'discount_description', 'contractor_client_id'],
      contract_versions: ['snapshot', 'snapshot_format'],
      contract_settings: [
        'studio_name',
        'forum_city',
        'withdrawal_notice_days',
        'text_clauses',
        'letterhead_sha256',
      ],
    };

    it('colunas novas existem', async () => {
      for (const [table, cols] of Object.entries(EXPECTED_COLUMNS)) {
        const rows = await adminPrisma.$queryRawUnsafe<{ column_name: string }[]>(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1`,
          table,
        );
        const have = rows.map((r) => r.column_name);
        for (const c of cols) expect({ table, c, ok: have.includes(c) }).toEqual({ table, c, ok: true });
      }
    });

    it('contract_deposit_installments e contract_letterheads tem RLS habilitada e forcada', async () => {
      const rows = await adminPrisma.$queryRawUnsafe<{ relname: string; e: boolean; f: boolean }[]>(
        `SELECT relname, relrowsecurity AS e, relforcerowsecurity AS f
           FROM pg_class WHERE relname = ANY($1::text[]) AND relkind = 'r'`,
        ['contract_deposit_installments', 'contract_letterheads'],
      );
      expect(rows).toHaveLength(2);
      for (const r of rows) expect({ t: r.relname, e: r.e, f: r.f }).toEqual({ t: r.relname, e: true, f: true });
    });

    it('contract_letterheads: sgs_app insere mas UPDATE/DELETE dao permission denied', async () => {
      const sha = createHash('sha256').update(`lh-${w.prefix}`).digest('hex');
      const inTenant = async (fn: (tx: Parameters<Parameters<typeof appPrisma.$transaction>[0]>[0]) => Promise<unknown>) =>
        appPrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_organization', ${w.orgId}, true)`;
          return fn(tx);
        });
      await inTenant((tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO contract_letterheads (organization_id, sha256, mime_type, width, height, size_bytes, data)
           VALUES ('${w.orgId}', '${sha}', 'image/png', 10, 10, 3, '\\x010203'::bytea)`,
        ),
      );
      const nil = '00000000-0000-0000-0000-000000000000';
      await expect(
        inTenant((tx) => tx.$executeRawUnsafe(`UPDATE contract_letterheads SET width = 11 WHERE id = '${nil}'`)),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        inTenant((tx) => tx.$executeRawUnsafe(`DELETE FROM contract_letterheads WHERE id = '${nil}'`)),
      ).rejects.toThrow(/permission denied/i);
      // helper de fixture tambem funciona
      const sha2 = createHash('sha256').update(`lh2-${w.prefix}`).digest('hex');
      const r = await insertLetterheadRow(adminPrisma, w.orgId, {
        sha256: sha2,
        data: Buffer.from([1, 2, 3, 4]),
        mimeType: 'image/png',
        width: 2,
        height: 2,
      });
      expect(r.id).toBeTruthy();
    });

    it('CHECKs: event_time invalido, payment_mode invalido e snapshot_format 2 sem snapshot falham', async () => {
      const g = await insertBridalGroupRow(w);
      await expect(
        adminPrisma.$executeRawUnsafe(`UPDATE bridal_groups SET event_time = '25:00' WHERE id = '${g.groupId}'`),
      ).rejects.toThrow(/chk_bg_event_time/);
      await adminPrisma.$executeRawUnsafe(
        `UPDATE bridal_groups SET event_time = '09:30' WHERE id = '${g.groupId}'`,
      );
      const c = await insertContractRow(w, {
        groupId: g.groupId,
        brideClientId: g.brideClientId,
        totalAmount: '500.00',
        depositAmount: '150.00',
        installments: [{ seq: 1, amount: '150.00', dueDate: '2030-01-10' }],
      });
      await expect(
        adminPrisma.$executeRawUnsafe(`UPDATE contracts SET payment_mode = 'boleto' WHERE id = '${c.contractId}'`),
      ).rejects.toThrow(/chk_contracts_payment_mode/);
      await expect(
        adminPrisma.$executeRawUnsafe(
          `UPDATE contract_versions SET snapshot_format = 2 WHERE contract_id = '${c.contractId}'`,
        ),
      ).rejects.toThrow(/chk_cv_snapshot_format/);
      const inst = await adminPrisma.contractDepositInstallment.findMany({
        where: { contractId: c.contractId },
      });
      expect(inst).toHaveLength(1);
    });
  });
});
