import { createHash } from 'node:crypto';
import { adminPrisma } from '../setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './phase3-fixtures';
import { deletePhase4Rows } from './phase4-cleanup';

export { gqlAs };

export interface Phase4World extends Phase3World {
  /** price "500.00", deposit_kind 'percent', deposit_value 30, com serviceId + serviceBId */
  bridalPackageId: string;
}

const orgFilter = (prefix: string) =>
  `SELECT id FROM organizations WHERE legal_name LIKE '${prefix}-%'`;

/** Mundo da Fase 3 + pacote de noiva (entrada de 30%). */
export async function createPhase4World(prefix: string): Promise<Phase4World> {
  // sobras de uma execucao anterior referenciam clientes/servicos; limpar antes do cleanup da Fase 3
  await deletePhase4Rows(orgFilter(prefix));
  const w = await createPhase3World(prefix);
  const bridalPackageId = (
    await adminPrisma.package.create({
      data: {
        organizationId: w.orgId,
        name: `${prefix}-pacote-noiva`,
        price: '500.00',
        depositKind: 'percent',
        depositValue: '30.00',
        services: {
          create: [
            { serviceId: w.serviceId, quantity: 1, displayOrder: 0 },
            { serviceId: w.serviceBId, quantity: 1, displayOrder: 1 },
          ],
        },
      },
    })
  ).id;
  return { ...w, bridalPackageId };
}

export async function destroyPhase4World(w: Phase4World): Promise<void> {
  await deletePhase4Rows(orgFilter(w.prefix));
  await destroyPhase3World(w);
}

let seq = 0;

export interface InsertBridalGroupOpts {
  companions?: number;
  eventDate?: string;
  /** cobertura por acompanhante (indice); padrao false. A noiva e sempre coberta. */
  covered?: boolean[];
  locationKind?: 'studio' | 'external';
  travelBefore?: number;
  travelAfter?: number;
  /** ISO 8601 */
  readyBy?: string;
}

/** Insere grupo + noiva + acompanhantes direto no banco (sem passar pelas mutations). */
export async function insertBridalGroupRow(
  w: Phase3World,
  opts: InsertBridalGroupOpts = {},
): Promise<{
  groupId: string;
  brideMemberId: string;
  brideClientId: string;
  companionMemberIds: string[];
  companionClientIds: string[];
}> {
  const n = ++seq;
  const external = opts.locationKind === 'external';
  const group = await adminPrisma.bridalGroup.create({
    data: {
      organizationId: w.orgId,
      name: `${w.prefix}-grupo-${n}`,
      eventDate: new Date(`${opts.eventDate ?? '2030-06-15'}T00:00:00.000Z`),
      readyBy: opts.readyBy ? new Date(opts.readyBy) : null,
      locationKind: opts.locationKind ?? 'studio',
      locationAddress: external ? 'Rua do Evento, 100' : null,
      travelMinutesBefore: opts.travelBefore ?? 0,
      travelMinutesAfter: opts.travelAfter ?? 0,
    },
  });
  const mkClient = (label: string) =>
    adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: `${w.prefix}-${label}-${n}` },
    });
  const brideClient = await mkClient('noiva');
  const bride = await adminPrisma.bridalGroupMember.create({
    data: {
      organizationId: w.orgId,
      groupId: group.id,
      clientId: brideClient.id,
      role: 'bride',
      coveredByContract: true,
      sortOrder: 0,
    },
  });
  const companionMemberIds: string[] = [];
  const companionClientIds: string[] = [];
  for (let i = 0; i < (opts.companions ?? 0); i++) {
    const c = await mkClient(`acomp-${i + 1}`);
    const m = await adminPrisma.bridalGroupMember.create({
      data: {
        organizationId: w.orgId,
        groupId: group.id,
        clientId: c.id,
        role: 'companion',
        coveredByContract: opts.covered?.[i] ?? false,
        sortOrder: i + 1,
      },
    });
    companionClientIds.push(c.id);
    companionMemberIds.push(m.id);
  }
  return {
    groupId: group.id,
    brideMemberId: bride.id,
    brideClientId: brideClient.id,
    companionMemberIds,
    companionClientIds,
  };
}

export interface InsertContractOpts {
  groupId: string;
  brideClientId: string;
  totalAmount: string;
  depositAmount: string;
  status?: string;
  balanceDueDate?: string;
  items?: { groupMemberId: string; serviceId: string; unitPrice: string }[];
}

const TEST_TEXT = 'texto';

/** Insere contrato (+ itens + versao 1) direto no banco. */
export async function insertContractRow(
  w: Phase3World,
  opts: InsertContractOpts,
): Promise<{ contractId: string; code: string }> {
  const n = ++seq;
  const code = `CT-TEST-${Date.now() % 1000000}-${n}`;
  const status = opts.status ?? 'draft';
  const contract = await adminPrisma.contract.create({
    data: {
      organizationId: w.orgId,
      code,
      bridalGroupId: opts.groupId,
      brideClientId: opts.brideClientId,
      status,
      itemsTotal: opts.totalAmount,
      discountAmount: '0.00',
      totalAmount: opts.totalAmount,
      depositAmount: opts.depositAmount,
      balanceDueDaysBefore: 10,
      balanceDueDate: new Date(`${opts.balanceDueDate ?? '2030-06-05'}T00:00:00.000Z`),
      cancellationPolicy: {
        version: 1,
        clientCancels: 'retain_all_paid',
        studioCancels: 'refund_all',
        clause: 'Cláusula de teste.',
      },
      currentVersion: 1,
      cancelledAt: status === 'cancelled' ? new Date() : null,
      items: {
        create: (opts.items ?? []).map((it, i) => ({
          organizationId: w.orgId,
          groupMemberId: it.groupMemberId,
          serviceId: it.serviceId,
          descriptionSnapshot: `${w.prefix}-item-${i + 1}`,
          quantity: 1,
          unitPrice: it.unitPrice,
          total: it.unitPrice,
          sortOrder: i,
        })),
      },
      versions: {
        create: {
          organizationId: w.orgId,
          version: 1,
          renderedText: TEST_TEXT,
          textSha256: createHash('sha256').update(TEST_TEXT).digest('hex'),
        },
      },
    },
  });
  return { contractId: contract.id, code };
}
