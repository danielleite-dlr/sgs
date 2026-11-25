import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adminPrisma, appPrisma } from './setup';
import {
  createPhase91World,
  destroyPhase91World,
  insertStudioBrideGroup,
  type Phase91World,
} from './helpers/phase91-fixtures';
import {
  loadBridalAssistantDailyRate,
  saveBridalAssistantDailyRate,
} from '../../src/catalog/packages/bridal-assistant-rate';
import type { TenantPrismaClient } from '../../src/database/types';

const SEED_ORG = '01a0b681-8b9b-790b-921d-4518350e534b';
const MIGRATION = join(
  __dirname,
  '../../prisma/migrations/20261124000100_seed_studio_js_bridal_assistant/migration.sql',
);
const MARKED = ['Decidida', 'Essencial', 'Elegance', 'Essence', 'Experience', 'Glam'];
const OTHERS = ['Make & Penteado (madrinhas)', 'Spa dos 15', 'Ouro Rosa'];
const ORGS = `SELECT id FROM organizations WHERE legal_name LIKE 'p91bf-%'`;

describe('09.1 — backfill da assistente da noiva', () => {
  let w: Phase91World;

  const inTenant = <T>(orgId: string, fn: (tx: TenantPrismaClient) => Promise<T>): Promise<T> =>
    appPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization', ${orgId}, true)`;
      return fn(tx as unknown as TenantPrismaClient);
    });

  beforeAll(async () => {
    w = await createPhase91World('p91bf');
  });
  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM package_cost_items WHERE organization_id IN (${ORGS})`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM contract_settings WHERE organization_id IN (${ORGS})`,
    );
    await destroyPhase91World(w);
  });

  async function mkPackage(orgId: string, name: string, cost: boolean): Promise<string> {
    const p = await adminPrisma.package.create({
      data: { organizationId: orgId, name, price: '1000.00' },
    });
    if (cost) {
      await adminPrisma.packageCostItem.create({
        data: { organizationId: orgId, packageId: p.id, name: 'Assistente', cost: '200.00' },
      });
    }
    return p.id;
  }

  it('marca só os 6 pacotes da org guardada e mantém o custo manual "Assistente"', async () => {
    const ids: Record<string, string> = {};
    for (const n of MARKED) ids[n] = await mkPackage(w.orgId, n, n === 'Essence' || n === 'Glam');
    for (const n of OTHERS) ids[n] = await mkPackage(w.orgId, n, n === 'Ouro Rosa');
    const otherGlam = await mkPackage(w.otherOrgId, 'Glam', true);

    const sql = readFileSync(MIGRATION, 'utf8');
    const statements = sql
      .split(/;\s*\n/)
      .map((s) =>
        s
          .split('\n')
          .filter((l) => !l.trim().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter((s) => s.length > 0);
    expect(statements).toHaveLength(1);
    for (const stmt of statements) {
      expect(stmt).toContain(SEED_ORG);
      await adminPrisma.$executeRawUnsafe(stmt.split(SEED_ORG).join(w.orgId));
    }

    const rows = await adminPrisma.package.findMany({
      where: { organizationId: w.orgId, name: { in: [...MARKED, ...OTHERS] } },
      select: { name: true, includesBridalAssistant: true },
    });
    expect(
      rows
        .filter((r) => r.includesBridalAssistant)
        .map((r) => r.name)
        .sort(),
    ).toEqual([...MARKED].sort());
    expect(
      rows
        .filter((r) => !r.includesBridalAssistant)
        .map((r) => r.name)
        .sort(),
    ).toEqual([...OTHERS].sort());

    const count = (packageId: string) =>
      adminPrisma.packageCostItem.count({ where: { packageId, name: 'Assistente' } });
    expect(await count(ids['Essence']!)).toBe(1);
    expect(await count(ids['Glam']!)).toBe(1);
    expect(await count(ids['Ouro Rosa']!)).toBe(1);

    const other = await adminPrisma.package.findUniqueOrThrow({ where: { id: otherGlam } });
    expect(other.includesBridalAssistant).toBe(false);
    expect(await count(otherGlam)).toBe(1);
  });

  it('time_blocks: acompanhamento exige grupo e é único por grupo', async () => {
    const { groupId } = await insertStudioBrideGroup(w, { eventDate: '2030-07-10' });
    const base = `'${w.orgId}'::uuid, 'acompanhamento', '2030-07-10T12:00:00Z', '2030-07-10T20:00:00Z', '${w.assistants.a}'::uuid`;
    await expect(
      adminPrisma.$executeRawUnsafe(
        `INSERT INTO time_blocks (organization_id, kind, starts_at, ends_at, professional_id)
         VALUES (${base})`,
      ),
    ).rejects.toThrow(/chk_time_blocks_travel/);
    const ins = `INSERT INTO time_blocks (organization_id, kind, starts_at, ends_at, professional_id, bridal_group_id)
         VALUES (${base}, '${groupId}'::uuid)`;
    await adminPrisma.$executeRawUnsafe(ins);
    // o Prisma não repassa o nome do índice (uq_time_blocks_group_escort), só o código 23505
    await expect(adminPrisma.$executeRawUnsafe(ins)).rejects.toThrow(/23505|already exists/);
  });

  it('diária vigente: 220.00 sem linha e o valor gravado depois', async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM contract_settings WHERE organization_id = '${w.orgId}'::uuid`,
    );
    expect(await inTenant(w.orgId, (tx) => loadBridalAssistantDailyRate(tx))).toBe('220.00');
    const saved = await inTenant(w.orgId, (tx) =>
      saveBridalAssistantDailyRate(tx, w.orgId, w.members.admin, '250.00'),
    );
    expect(saved).toBe('250.00');
    expect(await inTenant(w.orgId, (tx) => loadBridalAssistantDailyRate(tx))).toBe('250.00');
  });

  it('purge_member zera o vínculo quando a profissional é assistente de um grupo', async () => {
    const { groupId } = await insertStudioBrideGroup(w, { eventDate: '2030-08-10' });
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = '${w.assistants.b}'::uuid,
         assistant_daily_rate = 220.00, assistant_linked_at = now() WHERE id = '${groupId}'::uuid`,
    );
    await inTenant(w.orgId, (tx) =>
      tx.$executeRawUnsafe(`SELECT purge_member('${w.assistants.b}'::uuid)`),
    );
    const g = await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: groupId } });
    expect(g.assistantMemberId).toBeNull();
    expect(g.assistantDailyRate).toBeNull();
    expect(g.assistantLinkedAt).toBeNull();
    expect(await adminPrisma.member.count({ where: { id: w.assistants.b } })).toBe(0);
  });
});
