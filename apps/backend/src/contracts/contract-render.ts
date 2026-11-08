import type { Prisma } from '@prisma/client';
import { toCents } from '../common/money';
import type { TenantPrismaClient } from '../database/types';
import { ContractError } from './contract-errors';
import { localDate } from './contract-serialize';
import { loadEffectiveSettings } from './contract-settings.service';
import type { ReadinessInput } from './domain/contract-required-fields';
import {
  buildSnapshot,
  SNAPSHOT_FORMAT,
  snapshotHash,
  snapshotToPlainText,
  type ContractSnapshot,
  type SnapshotTexts,
} from './domain/contract-snapshot';
import {
  CONTRACT_TEXT_SECTIONS,
  renderContractText,
  type ContractTextVariable,
} from './domain/contract-texts';
import { estadoPorUf } from './domain/estado-por-uf';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const CLIENT_SELECT = {
  id: true,
  fullName: true,
  cpf: true,
  rg: true,
  address: true,
  postalCode: true,
  email: true,
  phone: true,
  phone2: true,
  phone3: true,
} as const;

const CONTRACT_INCLUDE_RENDER = {
  group: { include: { responsible: { select: CLIENT_SELECT } } },
  bride: { select: CLIENT_SELECT },
  package: { select: { name: true, contractDescription: true } },
  items: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      service: { select: { name: true } },
      member: { include: { client: { select: { fullName: true } } } },
    },
  },
  installments: { orderBy: { seq: 'asc' } },
} satisfies Prisma.ContractInclude;

async function loadContractForRender(tx: TenantPrismaClient, contractId: string) {
  const c = await tx.contract.findUnique({
    where: { id: contractId },
    include: CONTRACT_INCLUDE_RENDER,
  });
  if (!c) throw new ContractError('NOT_FOUND', 'Contrato não encontrado.', 'id');
  return c;
}
type ContractForRender = Awaited<ReturnType<typeof loadContractForRender>>;

/** Contratante: a noiva; na debutante, a responsável (pode faltar -> null). D-10. */
function pickContractor(c: ContractForRender) {
  return c.group.eventKind === 'debutante' ? c.group.responsible : c.bride;
}

async function orgToday(tx: TenantPrismaClient, orgId: string): Promise<string> {
  const org = await tx.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  return localDate(new Date(), org?.timezone ?? 'America/Sao_Paulo');
}

/**
 * Monta o snapshot estruturado (formato 2) a partir dos dados vivos, sem gravar nada.
 */
export async function buildLiveSnapshotTx(
  tx: TenantPrismaClient,
  orgId: string,
  contractId: string,
  opts: { generatedOn?: string } = {},
): Promise<{
  snapshot: ContractSnapshot;
  sha256: string;
  plainText: string;
  contractorClientId: string | null;
}> {
  const c = await loadContractForRender(tx, contractId);
  const settings = await loadEffectiveSettings(tx, orgId);
  const generatedOn = opts.generatedOn ?? (await orgToday(tx, orgId));
  const kind = c.group.eventKind === 'debutante' ? 'debutante' : 'noiva';
  const studio = settings.studio;
  const contractor = pickContractor(c);

  const vars: Record<ContractTextVariable, string> = {
    tipo_cliente: kind.toUpperCase(),
    prazo_restante_dias: String(c.balanceDueDaysBefore),
    prazo_desistencia_dias: String(settings.withdrawalNoticeDays),
    cidade_foro: studio.forumCity,
    // "Estado de São Paulo", por extenso (a configuração guarda só a UF).
    uf_foro: estadoPorUf(studio.forumUf),
    studio_nome: studio.name,
    studio_cnpj: studio.cnpj,
    studio_endereco: studio.address,
    studio_representante: studio.representative,
    studio_representante_rg: studio.representativeRg,
  };
  const texts = {} as SnapshotTexts;
  for (const section of CONTRACT_TEXT_SECTIONS) {
    texts[section] = renderContractText(settings.texts[section], vars);
  }

  const snapshot = buildSnapshot({
    code: c.code,
    kind,
    generatedOn,
    studio: { ...studio },
    letterhead: settings.letterhead
      ? {
          sha256: settings.letterhead.sha256,
          mimeType: settings.letterhead.mimeType,
        }
      : null,
    texts,
    contractor: {
      name: contractor?.fullName ?? null,
      cpf: contractor?.cpf ?? null,
      rg: contractor?.rg ?? null,
      address: contractor?.address ?? null,
      postalCode: contractor?.postalCode ?? null,
      email: contractor?.email ?? null,
      phone1: contractor?.phone ?? null,
      phone2: contractor?.phone2 ?? null,
      phone3: contractor?.phone3 ?? null,
    },
    debutanteName: kind === 'debutante' ? c.bride.fullName : null,
    event: {
      date: isoDate(c.group.eventDate),
      time: c.group.eventTime,
      locationName: c.group.locationName ?? (studio.name || null),
      serviceAddress: c.group.locationAddress ?? (studio.address || null),
    },
    package: c.package
      ? {
          name: c.package.name,
          description: c.package.contractDescription ?? null,
        }
      : null,
    items: c.items.map((it) => ({
      serviceName: it.service.name,
      personLabel: it.member.relationLabel ?? it.member.client.fullName,
      purpose: it.purpose === 'trial' ? 'trial' : 'event',
      quantity: it.quantity,
      totalCents: toCents(it.total),
      isPackageItem: it.packageId != null,
      sortOrder: it.sortOrder,
      settledAtEvent: it.settledAtEvent,
    })),
    discount: {
      cents: toCents(c.discountAmount),
      description: c.discountDescription,
    },
    totalCents: toCents(c.totalAmount),
    payment: {
      mode: c.paymentMode as 'sinal' | 'sinal_parcelado' | 'a_vista',
      installments: c.installments.map((i) => ({
        seq: i.seq,
        dueDate: isoDate(i.dueDate),
        cents: toCents(i.amount),
      })),
      balanceDueDaysBefore: c.balanceDueDaysBefore,
    },
  });

  return {
    snapshot,
    sha256: snapshotHash(snapshot),
    plainText: snapshotToPlainText(snapshot),
    contractorClientId: kind === 'debutante' ? (c.group.responsibleClientId ?? null) : null,
  };
}

/**
 * Grava uma nova `contract_versions` (formato 2, version = current_version + 1) com o
 * snapshot e o hash do snapshot. O chamador deve ter travado o contrato (FOR UPDATE).
 */
export async function renderContractVersionTx(
  tx: TenantPrismaClient,
  orgId: string,
  contractId: string,
  memberId: string,
): Promise<{ versionId: string; version: number; sha256: string }> {
  const live = await buildLiveSnapshotTx(tx, orgId, contractId);
  const current = await tx.contract.findUniqueOrThrow({
    where: { id: contractId },
    select: { currentVersion: true },
  });
  const version = current.currentVersion + 1;
  const row = await tx.contractVersion.create({
    data: {
      organizationId: orgId,
      contractId,
      version,
      renderedText: live.plainText,
      textSha256: live.sha256,
      snapshot: live.snapshot as unknown as Prisma.InputJsonValue,
      snapshotFormat: SNAPSHOT_FORMAT,
      createdBy: memberId,
    },
  });
  await tx.contract.update({
    where: { id: contractId },
    data: {
      currentVersion: version,
      contractorClientId: live.contractorClientId,
    },
  });
  return { versionId: row.id, version, sha256: live.sha256 };
}

/**
 * D-18: garante que a versão corrente está no layout novo e em dia com os dados vivos.
 * Legada (formato 1) ou com hash diferente -> versão nova; senão não cria nada.
 */
export async function refreshContractVersionTx(
  tx: TenantPrismaClient,
  orgId: string,
  contractId: string,
  memberId: string,
): Promise<{ created: boolean; version: number }> {
  const contract = await tx.contract.findUniqueOrThrow({
    where: { id: contractId },
    select: { currentVersion: true },
  });
  const current = await tx.contractVersion.findUnique({
    where: {
      uq_cv_contract_version: { contractId, version: contract.currentVersion },
    },
    select: { snapshotFormat: true, snapshot: true, textSha256: true },
  });
  const stale = async (): Promise<boolean> => {
    if (!current || current.snapshotFormat !== SNAPSHOT_FORMAT || !current.snapshot) return true;
    const generatedOn = (current.snapshot as unknown as ContractSnapshot).generatedOn;
    const live = await buildLiveSnapshotTx(tx, orgId, contractId, {
      generatedOn,
    });
    return live.sha256 !== current.textSha256;
  };
  if (!(await stale())) return { created: false, version: contract.currentVersion };
  const v = await renderContractVersionTx(tx, orgId, contractId, memberId);
  return { created: true, version: v.version };
}

/** Entrada do gate D-09 a partir dos dados vivos. */
export async function loadReadinessInputTx(
  tx: TenantPrismaClient,
  orgId: string,
  contractId: string,
): Promise<ReadinessInput> {
  const c = await loadContractForRender(tx, contractId);
  const settings = await loadEffectiveSettings(tx, orgId);
  const kind = c.group.eventKind === 'debutante' ? 'debutante' : 'noiva';
  const contractor = pickContractor(c);
  const s = settings.studio;
  return {
    kind,
    groupId: c.bridalGroupId,
    contractId: c.id,
    contractor: contractor
      ? {
          clientId: contractor.id,
          fullName: contractor.fullName,
          cpf: contractor.cpf,
          address: contractor.address,
          phone: contractor.phone,
          phone2: contractor.phone2,
        }
      : null,
    eventDate: c.group.eventDate ? isoDate(c.group.eventDate) : null,
    eventTime: c.group.eventTime,
    hasPackage: c.packageId != null,
    paymentMode: c.paymentMode as 'sinal' | 'sinal_parcelado' | 'a_vista',
    depositCents: toCents(c.depositAmount),
    studio: {
      name: s.name,
      cnpj: s.cnpj,
      representative: s.representative,
      address: s.address,
      forumCity: s.forumCity,
      forumUf: s.forumUf,
    },
  };
}
