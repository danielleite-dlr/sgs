import { randomUUID } from 'node:crypto';
import { adminPrisma, appPrisma } from './setup';
import {
  createPhase9World,
  destroyPhase9World,
  insertDealRow,
  insertLeadRow,
  stageIdOf,
  type Phase9World,
} from './helpers/phase9-fixtures';
import { insertBridalGroupRow, insertContractRow } from './helpers/phase4-fixtures';

const PHASE9_TABLES = [
  'commercial_stages',
  'commercial_leads',
  'commercial_deals',
  'commercial_interactions',
  'commercial_reminders',
  'commercial_form_settings',
] as const;

/** Executa `fn` numa transação do sgs_app (RLS) com o tenant indicado. */
async function asTenant<T>(
  orgId: string,
  fn: (tx: Parameters<Parameters<typeof appPrisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return appPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_organization', '${orgId}', true)`);
    return fn(tx);
  });
}

describe('fase 9 — RLS e permissões do Comercial', () => {
  let w: Phase9World;
  let leadId: string;
  let dealId: string;

  beforeAll(async () => {
    w = await createPhase9World('p9rls');
    leadId = await insertLeadRow(w);
    dealId = await insertDealRow(w, { leadId });
    const interactionId = randomUUID();
    await adminPrisma.$executeRawUnsafe(
      `INSERT INTO commercial_interactions (id, organization_id, lead_id, deal_id, type)
       VALUES ('${interactionId}', '${w.orgId}', '${leadId}', '${dealId}', 'call')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `INSERT INTO commercial_reminders (organization_id, lead_id, deal_id, title, due_at)
       VALUES ('${w.orgId}', '${leadId}', '${dealId}', 'Ligar', now() + interval '1 day')`,
    );
    await adminPrisma.$executeRawUnsafe(
      `INSERT INTO commercial_form_settings (organization_id, token) VALUES ('${w.orgId}', '${randomUUID().replace(/-/g, '')}')`,
    );
  }, 120_000);

  afterAll(async () => {
    await destroyPhase9World(w);
  }, 120_000);

  describe('isolamento por organização', () => {
    it.each(PHASE9_TABLES.map((t) => [t]))(
      '%s: org A tem linhas, org B enxerga 0 e A não vê outras orgs',
      async (table) => {
        const rowsA = await adminPrisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id = '${w.orgId}'`,
        );
        expect([table, Number(rowsA[0].n) > 0]).toEqual([table, true]);

        const asB = await asTenant(w.otherOrgId, (tx) =>
          tx.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id = '${w.orgId}'`,
          ),
        );
        expect([table, Number(asB[0].n)]).toEqual([table, 0]);

        const asA = await asTenant(w.orgId, (tx) =>
          tx.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*)::bigint AS n FROM ${table} WHERE organization_id <> '${w.orgId}'`,
          ),
        );
        expect([table, Number(asA[0].n)]).toEqual([table, 0]);
      },
    );

    it('INSERT com organization_id da org A na sessão da org B viola a policy (WITH CHECK)', async () => {
      const inserts: Record<string, string> = {
        commercial_stages: `INSERT INTO commercial_stages (organization_id, name, color, position, kind) VALUES ('${w.orgId}', 'hack', '#112233', 9, 'open')`,
        commercial_leads: `INSERT INTO commercial_leads (organization_id, full_name, phone) VALUES ('${w.orgId}', 'hack', '11999990000')`,
        commercial_deals: `INSERT INTO commercial_deals (organization_id, lead_id, stage_id, kind) VALUES ('${w.orgId}', '${leadId}', '${await stageIdOf(w.orgId, 'Novo')}', 'noiva')`,
        commercial_interactions: `INSERT INTO commercial_interactions (organization_id, lead_id, type) VALUES ('${w.orgId}', '${leadId}', 'call')`,
        commercial_reminders: `INSERT INTO commercial_reminders (organization_id, title, due_at) VALUES ('${w.orgId}', 'hack', now())`,
        // a org A já tem settings (UNIQUE), mas a policy (WITH CHECK) é avaliada antes da unicidade
        commercial_form_settings: `INSERT INTO commercial_form_settings (organization_id, token) VALUES ('${w.orgId}', 'x')`,
      };
      for (const [table, sql] of Object.entries(inserts)) {
        const result = await asTenant(w.otherOrgId, (tx) => tx.$executeRawUnsafe(sql))
          .then(() => 'inseriu')
          .catch((e: Error) =>
            /row-level security|violates/i.test(e.message) ? 'bloqueado' : e.message,
          );
        expect([table, result]).toEqual([table, 'bloqueado']);
      }
    });

    it('RLS está habilitada e FORÇADA nas 6 tabelas (relforcerowsecurity)', async () => {
      const rows = await adminPrisma.$queryRawUnsafe<
        { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
      >(
        `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
         WHERE relkind = 'r' AND relname IN (${PHASE9_TABLES.map((t) => `'${t}'`).join(',')})
         ORDER BY relname`,
      );
      expect(rows).toHaveLength(6);
      for (const r of rows) {
        expect([r.relname, r.relrowsecurity, r.relforcerowsecurity]).toEqual([
          r.relname,
          true,
          true,
        ]);
      }
    });
  });

  describe('matriz de permissões em role_permissions', () => {
    async function commercialPerms(role: string): Promise<string[]> {
      const rows = await adminPrisma.$queryRawUnsafe<{ permission: string }[]>(
        `SELECT rp.permission FROM role_permissions rp
         JOIN roles r ON r.id = rp.role_id
         WHERE r.name = '${role}' AND r.is_system = true AND rp.permission LIKE 'commercial.%'
         ORDER BY rp.permission`,
      );
      return rows.map((r) => r.permission);
    }

    it('ADMIN e MANAGER: read, write e manage', async () => {
      const all = ['commercial.manage', 'commercial.read', 'commercial.write'];
      expect(await commercialPerms('ADMIN')).toEqual(all);
      expect(await commercialPerms('MANAGER')).toEqual(all);
    });

    it('ATTENDANT: só read e write', async () => {
      expect(await commercialPerms('ATTENDANT')).toEqual(['commercial.read', 'commercial.write']);
    });

    it('PROFESSIONAL: nenhuma', async () => {
      expect(await commercialPerms('PROFESSIONAL')).toEqual([]);
    });
  });

  describe('etapas padrão e CHECKs', () => {
    it('a org tem as 6 etapas, com exatamente uma won e uma lost de sistema', async () => {
      const rows = await adminPrisma.commercialStage.findMany({
        where: { organizationId: w.orgId },
        orderBy: { position: 'asc' },
      });
      expect(rows.map((r) => r.name)).toEqual([
        'Novo',
        'Contato',
        'Proposta',
        'Negociação',
        'Ganho',
        'Perdido',
      ]);
      expect(rows.filter((r) => r.kind === 'won')).toHaveLength(1);
      expect(rows.filter((r) => r.kind === 'lost')).toHaveLength(1);
      expect(rows.filter((r) => r.isSystem).map((r) => r.kind)).toEqual(['won', 'lost']);
    });

    it('segunda etapa kind=won na mesma org viola uq_cs_won', async () => {
      await expect(
        adminPrisma.$executeRawUnsafe(
          `INSERT INTO commercial_stages (organization_id, name, color, position, kind)
           VALUES ('${w.orgId}', 'Ganho 2', '#112233', 102, 'won')`,
        ),
      ).rejects.toThrow(/23505|already exists|uq_cs_won/);
    });

    it('negócio com kind social viola o CHECK (D-05)', async () => {
      await expect(
        adminPrisma.$executeRawUnsafe(
          `INSERT INTO commercial_deals (organization_id, lead_id, stage_id, kind)
           VALUES ('${w.orgId}', '${leadId}', '${await stageIdOf(w.orgId, 'Novo')}', 'social')`,
        ),
      ).rejects.toThrow(/chk_cd_kind|check constraint/);
    });

    it('perdido sem lost_reason_code viola chk_cd_lost (D-10)', async () => {
      await expect(
        adminPrisma.$executeRawUnsafe(
          `UPDATE commercial_deals SET status = 'lost' WHERE id = '${dealId}'`,
        ),
      ).rejects.toThrow(/chk_cd_lost|check constraint/);
      // com o motivo, passa
      await adminPrisma.$executeRawUnsafe(
        `UPDATE commercial_deals SET status = 'lost', lost_reason_code = 'price' WHERE id = '${dealId}'`,
      );
      await adminPrisma.$executeRawUnsafe(
        `UPDATE commercial_deals SET status = 'open', lost_reason_code = NULL WHERE id = '${dealId}'`,
      );
    });
  });

  describe('exclusão definitiva (purge_member / purge_bridal_group)', () => {
    it('continuam funcionando com negócios apontando para o membro e o contrato', async () => {
      const g = await insertBridalGroupRow(w, {});
      const { contractId } = await insertContractRow(w, {
        groupId: g.groupId,
        brideClientId: g.brideClientId,
        totalAmount: '500.00',
        depositAmount: '150.00',
      });
      const pLead = await insertLeadRow(w, {
        createdBy: w.members.proB,
        clientId: g.brideClientId,
      });
      const pDeal = await insertDealRow(w, { leadId: pLead, assignee: w.members.proB });
      await adminPrisma.$executeRawUnsafe(
        `UPDATE commercial_deals SET created_by = '${w.members.proB}',
           won_contract_id = '${contractId}', won_client_id = '${g.brideClientId}'
         WHERE id = '${pDeal}'`,
      );

      // purge_member(proB): negócio e lead ficam, com as referências anuladas
      await asTenant(w.orgId, (tx) =>
        tx.$executeRawUnsafe(`SELECT purge_member('${w.members.proB}'::uuid)`),
      );
      const afterMember = await adminPrisma.commercialDeal.findUniqueOrThrow({
        where: { id: pDeal },
      });
      expect(afterMember.assigneeMemberId).toBeNull();
      expect(afterMember.createdBy).toBeNull();
      expect(afterMember.wonContractId).toBe(contractId);
      const leadAfterMember = await adminPrisma.commercialLead.findUniqueOrThrow({
        where: { id: pLead },
      });
      expect(leadAfterMember.createdBy).toBeNull();

      // purge_bridal_group: apaga contrato e clientes do grupo; o negócio sobrevive
      await asTenant(w.orgId, (tx) =>
        tx.$executeRawUnsafe(`SELECT purge_bridal_group('${g.groupId}'::uuid)`),
      );
      const afterGroup = await adminPrisma.commercialDeal.findUniqueOrThrow({
        where: { id: pDeal },
      });
      expect(afterGroup.wonContractId).toBeNull();
      expect(await adminPrisma.contract.count({ where: { id: contractId } })).toBe(0);
    }, 60_000);
  });
});
