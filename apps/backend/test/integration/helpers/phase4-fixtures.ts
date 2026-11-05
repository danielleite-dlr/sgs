import { createHash } from 'node:crypto';
import { adminPrisma } from '../setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './phase3-fixtures';
import { deletePhase4Rows } from './phase4-cleanup';
import type { AnthropicLike } from '../../../src/bridal/ai/anthropic-client';

export { gqlAs };

export interface Phase4World extends Phase3World {
  /** price "500.00", deposit_kind 'percent', deposit_value 30, com serviceId + serviceBId */
  bridalPackageId: string;
}

const orgFilter = (prefix: string) =>
  `SELECT id FROM organizations WHERE legal_name LIKE '${prefix}-%'`;

/** Mundo da Fase 3 + pacote de noiva (entrada de 30%). */
export async function createPhase4World(
  prefix: string,
  opts: { anthropicClient?: AnthropicLike | null } = {},
): Promise<Phase4World> {
  // sobras de uma execucao anterior referenciam clientes/servicos; limpar antes do cleanup da Fase 3
  await deletePhase4Rows(orgFilter(prefix));
  const w = await createPhase3World(prefix, opts);
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

/** Cliente com todos os campos exigidos pelo contrato (CPF valido, RG, CEP, celulares). */
export const COMPLETE_CLIENT = {
  cpf: '52998224725',
  rg: '12.345.678-9',
  postalCode: '06083-290',
  address: 'Rua das Flores, 10 – Osasco/SP',
  phone: '+5511982529341',
  phone2: '+5511911112222',
  phone3: null as string | null,
  email: 'noiva@example.com',
};

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
  eventKind?: 'noiva' | 'debutante';
  responsibleClientId?: string | null;
  /** "HH:MM" */
  eventTime?: string | null;
  locationName?: string | null;
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
      ...(opts.eventKind ? { eventKind: opts.eventKind } : {}),
      responsibleClientId: opts.responsibleClientId ?? null,
      eventTime: opts.eventTime ?? null,
      locationName: opts.locationName ?? null,
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
  paymentMode?: 'sinal' | 'sinal_parcelado' | 'a_vista';
  discountDescription?: string | null;
  contractorClientId?: string | null;
  /** parcelas do sinal (contract_deposit_installments); dueDate "YYYY-MM-DD" */
  installments?: { seq: number; amount: string; dueDate: string }[];
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
      ...(opts.paymentMode ? { paymentMode: opts.paymentMode } : {}),
      discountDescription: opts.discountDescription ?? null,
      contractorClientId: opts.contractorClientId ?? null,
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
      installments: {
        create: (opts.installments ?? []).map((i) => ({
          organizationId: w.orgId,
          seq: i.seq,
          amount: i.amount,
          dueDate: new Date(`${i.dueDate}T00:00:00.000Z`),
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

export interface InsertLetterheadOpts {
  sha256: string;
  data: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
}

/** Insere um papel timbrado (contract_letterheads) direto no banco. */
export async function insertLetterheadRow(
  db: typeof adminPrisma,
  orgId: string,
  opts: InsertLetterheadOpts,
): Promise<{ id: string }> {
  const row = await db.contractLetterhead.create({
    data: {
      organizationId: orgId,
      sha256: opts.sha256,
      mimeType: opts.mimeType,
      width: opts.width,
      height: opts.height,
      sizeBytes: opts.data.length,
      data: new Uint8Array(opts.data),
    },
  });
  return { id: row.id };
}

/** Dados do studio completos (gate D-09, fase 04.1). */
export async function completeStudioSettings(w: Phase3World): Promise<void> {
  const studio = {
    studioName: 'Studio Teste',
    studioCnpj: '48.562.103/0001-71',
    studioAddress: 'Rua do Studio, 1 – Osasco/SP',
    studioRepresentative: 'Dona Teste',
    studioRepresentativeRg: '11.111.111-1',
    forumCity: 'Osasco',
    forumUf: 'SP',
  };
  await adminPrisma.contractSettings.upsert({
    where: { organizationId: w.orgId },
    create: { organizationId: w.orgId, ...studio },
    update: studio,
  });
}

/**
 * Deixa um grupo/contrato apto a gerar o link (gate D-09, fase 04.1): contratante com CPF,
 * endereço e dois celulares, horário do evento e dados completos do studio.
 */
export async function makeContractReady(
  w: Phase3World,
  grp: { groupId: string; brideClientId: string },
): Promise<void> {
  await adminPrisma.client.update({
    where: { id: grp.brideClientId },
    data: {
      cpf: COMPLETE_CLIENT.cpf,
      rg: COMPLETE_CLIENT.rg,
      postalCode: COMPLETE_CLIENT.postalCode,
      address: COMPLETE_CLIENT.address,
      phone: COMPLETE_CLIENT.phone,
      phone2: COMPLETE_CLIENT.phone2,
      email: COMPLETE_CLIENT.email,
    },
  });
  await adminPrisma.bridalGroup.update({
    where: { id: grp.groupId },
    data: { eventTime: '16:00' },
  });
  await completeStudioSettings(w);
}

/** Vincula o pacote do mundo ao contrato (gate D-09 exige pacote); itens existentes seguem como extras. */
export async function attachPackage(w: Phase4World, contractId: string): Promise<void> {
  await adminPrisma.contract.update({
    where: { id: contractId },
    data: { packageId: w.bridalPackageId },
  });
}
