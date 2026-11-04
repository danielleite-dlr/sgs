import { adminPrisma, appPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  type Phase4World,
} from './helpers/phase4-fixtures';

describe('job_list_active_orgs() sem tenant (sgs_app)', () => {
  let w: Phase4World;

  beforeAll(async () => {
    w = await createPhase4World('p4jobs');
  });

  afterAll(async () => {
    await destroyPhase4World(w);
  });

  it('devolve as organizacoes ativas e seus fusos, sem contexto de tenant', async () => {
    const rows = await appPrisma.$queryRaw<{ organization_id: string; timezone: string }[]>`
      SELECT organization_id, timezone FROM job_list_active_orgs()`;
    const ids = rows.map((r) => r.organization_id);
    expect(ids).toEqual(expect.arrayContaining([w.orgId, w.otherOrgId]));
    const mine = rows.find((r) => r.organization_id === w.orgId);
    expect(mine?.timezone).toBe('America/Sao_Paulo');
  });

  it('nao lista organizacoes inativas', async () => {
    await adminPrisma.organization.update({ where: { id: w.otherOrgId }, data: { status: 'suspended' } });
    try {
      const rows = await appPrisma.$queryRaw<{ organization_id: string }[]>`
        SELECT organization_id FROM job_list_active_orgs()`;
      const ids = rows.map((r) => r.organization_id);
      expect(ids).toContain(w.orgId);
      expect(ids).not.toContain(w.otherOrgId);
    } finally {
      await adminPrisma.organization.update({ where: { id: w.otherOrgId }, data: { status: 'active' } });
    }
  });

  it('prova de necessidade: organizations sem tenant devolve 0 linhas para sgs_app', async () => {
    const orgs = await appPrisma.organization.findMany();
    expect(orgs).toHaveLength(0);
  });
});
