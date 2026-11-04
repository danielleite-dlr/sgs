import { Injectable } from '@nestjs/common';
import { syncContractCoverageTx } from '../bridal/bridal-coverage';
import { applyPackageToBrideTx } from '../bridal/bridal-package';
import { prorateServiceUnits } from '../comandas/comanda-items';
import { recordAudit } from '../common/audit-log';
import { fromCents, parseMoneyInput, toCents } from '../common/money';
import { AppConfigService } from '../config/app-config.service';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { nextContractCode } from './contract-code';
import { ContractError, mapContractError, type ContractUserError } from './contract-errors';
import { lockContract } from './contract-lock';
import { renderContractVersionTx } from './contract-render';
import {
  loadContractView,
  loadContractViews,
  type ContractView,
} from './contract-serialize';
import { loadEffectiveSettings } from './contract-settings.service';
import { buildPolicySnapshot } from './domain/cancellation-policy';
import {
  balanceDueDate,
  computeContractTotals,
  computeDepositCents,
  type DepositKind,
} from './domain/contract-math';
import { ACCESS_TOKEN_TTL_DAYS, newAccessToken } from './domain/contract-token';

export interface ContractItemInput {
  groupMemberId: string;
  serviceId: string;
  unitPrice?: string | null;
  quantity?: number | null;
  purpose?: string | null;
}

export interface CreateContractInput {
  groupId: string;
  packageId?: string | null;
  items?: ContractItemInput[] | null;
  discountAmount?: string | null;
  depositAmount?: string | null;
  balanceDueDaysBefore?: number | null;
}

export type UpdateContractInput = Omit<CreateContractInput, 'groupId'>;

export interface ContractPayload {
  contract: ContractView | null;
  errors: ContractUserError[];
}

export interface ContractLinkPayload extends ContractPayload {
  url: string | null;
  expiresAt: Date | null;
}

interface ItemDraft {
  groupMemberId: string;
  serviceId: string;
  packageId: string | null;
  description: string;
  quantity: number;
  unitCents: number;
  purpose: 'event' | 'trial';
}

type GroupWithMembers = NonNullable<Awaited<ReturnType<typeof loadGroup>>>;

const EDITABLE = ['draft', 'awaiting_acceptance', 'active'];
const MAX_QUANTITY = 99;

function loadGroup(tx: TenantPrismaClient, groupId: string) {
  return tx.bridalGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        orderBy: { sortOrder: 'asc' },
        include: { services: { orderBy: { sortOrder: 'asc' }, include: { service: true } } },
      },
    },
  });
}

function parseCents(v: string | null | undefined, field: string, fallback: number | null) {
  if (v == null) return fallback;
  const cents = parseMoneyInput(v);
  if (cents === null) {
    throw new ContractError('INVALID_AMOUNT', 'Valor monetário inválido.', field);
  }
  return cents;
}

function checkDays(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 365) {
    throw new ContractError(
      'INVALID_DAYS',
      'O prazo do restante deve ficar entre 0 e 365 dias antes do evento.',
      'balanceDueDaysBefore',
    );
  }
  return n;
}

async function buildItems(
  tx: TenantPrismaClient,
  group: GroupWithMembers,
  items: ContractItemInput[] | null | undefined,
  packageId: string | null,
): Promise<ItemDraft[]> {
  const covered = group.members.filter((m) => m.coveredByContract);

  // 1. itens explícitos
  if (items && items.length > 0) {
    const serviceIds = [...new Set(items.map((i) => i.serviceId))];
    const services = await tx.service.findMany({
      where: { id: { in: serviceIds }, deletedAt: null },
    });
    const byId = new Map(services.map((s) => [s.id, s]));
    return items.map((it) => {
      const member = group.members.find((m) => m.id === it.groupMemberId);
      if (!member) {
        throw new ContractError('MEMBER_NOT_FOUND', 'Pessoa não pertence ao grupo.', 'items');
      }
      if (!member.coveredByContract) {
        throw new ContractError(
          'MEMBER_NOT_COVERED',
          'Esta pessoa não está coberta pelo contrato.',
          'items',
        );
      }
      const service = byId.get(it.serviceId);
      if (!service) {
        throw new ContractError('SERVICE_NOT_FOUND', 'Serviço não encontrado.', 'items');
      }
      const quantity = it.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        throw new ContractError('INVALID_QUANTITY', 'Quantidade inválida.', 'items');
      }
      const purpose = it.purpose ?? 'event';
      if (purpose !== 'event' && purpose !== 'trial') {
        throw new ContractError('INVALID_PURPOSE', 'Finalidade inválida.', 'items');
      }
      return {
        groupMemberId: member.id,
        serviceId: service.id,
        packageId: null,
        description: service.name,
        quantity,
        unitCents: parseCents(it.unitPrice, 'items', toCents(service.basePrice)) as number,
        purpose,
      };
    });
  }

  const planned = (members: typeof covered): ItemDraft[] =>
    members.flatMap((m) =>
      m.services.map((s) => ({
        groupMemberId: m.id,
        serviceId: s.serviceId,
        packageId: null,
        description: s.service.name,
        quantity: 1,
        unitCents: toCents(s.service.basePrice),
        purpose: (s.purpose === 'trial' ? 'trial' : 'event') as 'event' | 'trial',
      })),
    );

  // 2. pacote: itens da noiva rateados + planejados das demais pessoas cobertas
  if (packageId) {
    const pkg = await tx.package.findFirst({
      where: { id: packageId, deletedAt: null },
      include: {
        services: { orderBy: { displayOrder: 'asc' }, include: { service: true } },
      },
    });
    if (!pkg) throw new ContractError('PACKAGE_NOT_FOUND', 'Pacote não encontrado.', 'packageId');
    const bride = group.members.find((m) => m.role === 'bride');
    if (!bride) throw new ContractError('MEMBER_NOT_FOUND', 'Grupo sem noiva.', 'groupId');
    const units = pkg.services.flatMap((ps) =>
      Array.from({ length: ps.quantity }, () => ps.service),
    );
    const charged = await prorateServiceUnits(
      tx,
      units.map((s) => ({ listCents: toCents(s.basePrice), service: s })),
      toCents(pkg.price),
    );
    const brideItems: ItemDraft[] = units.map((s, i) => ({
      groupMemberId: bride.id,
      serviceId: s.id,
      packageId: pkg.id,
      description: `${s.name} (pacote ${pkg.name})`,
      quantity: 1,
      unitCents: charged[i],
      purpose: 'event',
    }));
    return [...brideItems, ...planned(covered.filter((m) => m.role !== 'bride'))];
  }

  // 3. serviços planejados de todas as pessoas cobertas
  return planned(covered);
}

/**
 * O pacote escolhido no contrato passa a valer para o grupo: grava o package_id
 * do grupo e adiciona à noiva os serviços do pacote que faltam (nunca remove).
 * - create: aplica sempre que o contrato tem pacote (`previousPackageId` undefined).
 * - update: só aplica quando o pacote final do contrato mudou ou o grupo ainda
 *   não tem pacote — editar só desconto/outros campos não sobrescreve um pacote
 *   que a usuária escolheu no grupo.
 * Limpar o pacote no contrato não limpa o grupo nem remove serviços.
 */
async function syncGroupPackageTx(
  tx: TenantPrismaClient,
  orgId: string,
  groupId: string,
  packageId: string | null,
  previousPackageId?: string | null,
): Promise<void> {
  if (!packageId) return;
  if (previousPackageId !== undefined && packageId === previousPackageId) {
    const g = await tx.bridalGroup.findUnique({
      where: { id: groupId },
      select: { packageId: true },
    });
    if (g?.packageId) return;
  }
  await tx.bridalGroup.update({ where: { id: groupId }, data: { packageId } });
  await applyPackageToBrideTx(tx, orgId, groupId, packageId);
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly config: AppConfigService,
  ) {}

  private fail(e: unknown): ContractPayload {
    const m = mapContractError(e);
    if (m) return { contract: null, errors: [m] };
    throw e;
  }

  async create(
    orgId: string,
    memberId: string,
    input: CreateContractInput,
  ): Promise<ContractPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const group = await loadGroup(tx, input.groupId);
        if (!group) throw new ContractError('GROUP_NOT_FOUND', 'Grupo não encontrado.', 'groupId');
        if (group.status !== 'active') {
          throw new ContractError('GROUP_NOT_ACTIVE', 'O grupo não está ativo.', 'groupId');
        }
        const live = await tx.contract.findFirst({
          where: { bridalGroupId: group.id, status: { not: 'cancelled' } },
          select: { id: true },
        });
        if (live) {
          throw new ContractError(
            'GROUP_HAS_CONTRACT',
            'Este grupo já possui um contrato ativo.',
            'groupId',
          );
        }
        const bride = group.members.find((m) => m.role === 'bride');
        if (!bride) throw new ContractError('MEMBER_NOT_FOUND', 'Grupo sem noiva.', 'groupId');

        const pkg = input.packageId
          ? await tx.package.findFirst({ where: { id: input.packageId, deletedAt: null } })
          : null;
        if (input.packageId && !pkg) {
          throw new ContractError('PACKAGE_NOT_FOUND', 'Pacote não encontrado.', 'packageId');
        }

        const drafts = await buildItems(tx, group, input.items, pkg?.id ?? null);
        if (drafts.length === 0) {
          throw new ContractError('ITEMS_REQUIRED', 'Adicione ao menos um item.', 'items');
        }
        const itemsCents = drafts.map((d) => d.unitCents * d.quantity);
        const discountCents = parseCents(input.discountAmount, 'discountAmount', 0) as number;
        const { totalCents } = computeContractTotals({ itemsCents, discountCents, depositCents: 0 });
        const explicitDeposit = parseCents(input.depositAmount, 'depositAmount', null);
        const depositCents =
          explicitDeposit ??
          computeDepositCents(
            (pkg?.depositKind as DepositKind | null) ?? null,
            pkg?.depositValue?.toString() ?? null,
            totalCents,
          );
        const totals = computeContractTotals({ itemsCents, discountCents, depositCents });

        const settings = await loadEffectiveSettings(tx, orgId);
        const days = checkDays(input.balanceDueDaysBefore ?? settings.balanceDueDaysBefore);
        const eventDate = group.eventDate.toISOString().slice(0, 10);
        const dueDate = balanceDueDate(eventDate, days);
        const code = await nextContractCode(tx, orgId, group.eventDate.getUTCFullYear());

        const contract = await tx.contract.create({
          data: {
            organizationId: orgId,
            code,
            bridalGroupId: group.id,
            brideClientId: bride.clientId,
            packageId: pkg?.id ?? null,
            status: 'draft',
            itemsTotal: fromCents(totals.itemsTotalCents),
            discountAmount: fromCents(discountCents),
            totalAmount: fromCents(totals.totalCents),
            depositAmount: fromCents(totals.depositCents),
            balanceDueDaysBefore: days,
            balanceDueDate: new Date(`${dueDate}T00:00:00.000Z`),
            cancellationPolicy: buildPolicySnapshot(settings.cancellationClause),
            createdBy: memberId,
            items: {
              create: drafts.map((d, i) => ({
                organizationId: orgId,
                groupMemberId: d.groupMemberId,
                serviceId: d.serviceId,
                packageId: d.packageId,
                descriptionSnapshot: d.description.slice(0, 200),
                quantity: d.quantity,
                unitPrice: fromCents(d.unitCents),
                total: fromCents(d.unitCents * d.quantity),
                purpose: d.purpose,
                sortOrder: i,
              })),
            },
          },
        });
        await renderContractVersionTx(tx, orgId, contract.id, memberId);
        await recordAudit(tx, {
          orgId,
          actorMemberId: memberId,
          action: 'contract.create',
          entityType: 'contract',
          entityId: contract.id,
          metadata: { code, totalCents: totals.totalCents, depositCents: totals.depositCents },
        });
        await syncGroupPackageTx(tx, orgId, group.id, pkg?.id ?? null);
        await syncContractCoverageTx(tx, orgId, group.id);
        return { contract: await loadContractView(tx, orgId, contract.id), errors: [] };
      });
    } catch (e) {
      return this.fail(e);
    }
  }

  async update(
    orgId: string,
    memberId: string,
    id: string,
    input: UpdateContractInput,
  ): Promise<ContractPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const locked = await lockContract(tx, id);
        if (!EDITABLE.includes(locked.status)) {
          throw new ContractError(
            'CONTRACT_NOT_EDITABLE',
            'Este contrato não pode mais ser editado.',
            'id',
          );
        }
        const current = await tx.contract.findUniqueOrThrow({ where: { id } });
        const group = await loadGroup(tx, current.bridalGroupId);
        if (!group) throw new ContractError('GROUP_NOT_FOUND', 'Grupo não encontrado.', 'groupId');

        let packageId = current.packageId;
        let pkg: Awaited<ReturnType<typeof tx.package.findFirst>> = null;
        if (input.packageId !== undefined) {
          packageId = input.packageId;
          if (packageId) {
            pkg = await tx.package.findFirst({ where: { id: packageId, deletedAt: null } });
            if (!pkg) {
              throw new ContractError('PACKAGE_NOT_FOUND', 'Pacote não encontrado.', 'packageId');
            }
          }
        }

        let itemsCents: number[];
        let drafts: ItemDraft[] | null = null;
        if (input.items && input.items.length > 0) {
          drafts = await buildItems(tx, group, input.items, null);
          itemsCents = drafts.map((d) => d.unitCents * d.quantity);
        } else if (input.items) {
          throw new ContractError('ITEMS_REQUIRED', 'Adicione ao menos um item.', 'items');
        } else {
          const existing = await tx.contractItem.findMany({ where: { contractId: id } });
          itemsCents = existing.map((e) => toCents(e.total));
        }

        const discountCents = parseCents(
          input.discountAmount,
          'discountAmount',
          toCents(current.discountAmount),
        ) as number;
        const depositCents = parseCents(
          input.depositAmount,
          'depositAmount',
          toCents(current.depositAmount),
        ) as number;
        const totals = computeContractTotals({ itemsCents, discountCents, depositCents });

        const paid = await tx.contractPayment.aggregate({
          where: { contractId: id },
          _sum: { amount: true },
        });
        const paidCents = toCents(paid._sum.amount ?? 0);
        if (totals.totalCents < paidCents) {
          throw new ContractError(
            'TOTAL_BELOW_PAID',
            'O novo total é menor que o valor já pago.',
            'discountAmount',
          );
        }

        const days = checkDays(input.balanceDueDaysBefore ?? current.balanceDueDaysBefore);
        // sempre a partir da data atual do evento (o evento pode ter sido remarcado)
        const dueDate = balanceDueDate(group.eventDate.toISOString().slice(0, 10), days);

        if (drafts) {
          await tx.contractItem.deleteMany({ where: { contractId: id } });
          await tx.contractItem.createMany({
            data: drafts.map((d, i) => ({
              organizationId: orgId,
              contractId: id,
              groupMemberId: d.groupMemberId,
              serviceId: d.serviceId,
              packageId: d.packageId,
              descriptionSnapshot: d.description.slice(0, 200),
              quantity: d.quantity,
              unitPrice: fromCents(d.unitCents),
              total: fromCents(d.unitCents * d.quantity),
              purpose: d.purpose,
              sortOrder: i,
            })),
          });
        }
        await tx.contract.update({
          where: { id },
          data: {
            packageId,
            itemsTotal: fromCents(totals.itemsTotalCents),
            discountAmount: fromCents(discountCents),
            totalAmount: fromCents(totals.totalCents),
            depositAmount: fromCents(totals.depositCents),
            balanceDueDaysBefore: days,
            balanceDueDate: new Date(`${dueDate}T00:00:00.000Z`),
            status: locked.status === 'draft' ? 'draft' : 'awaiting_acceptance',
          },
        });
        const v = await renderContractVersionTx(tx, orgId, id, memberId);
        await tx.contractAccessToken.updateMany({
          where: { contractId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: memberId,
          action: 'contract.update',
          entityType: 'contract',
          entityId: id,
          metadata: { version: v.version },
        });
        await syncGroupPackageTx(tx, orgId, current.bridalGroupId, packageId, current.packageId);
        await syncContractCoverageTx(tx, orgId, current.bridalGroupId);
        return { contract: await loadContractView(tx, orgId, id), errors: [] };
      });
    } catch (e) {
      return this.fail(e);
    }
  }

  async generateLink(orgId: string, memberId: string, id: string): Promise<ContractLinkPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const locked = await lockContract(tx, id);
        if (!EDITABLE.includes(locked.status)) {
          throw new ContractError(
            'CONTRACT_NOT_EDITABLE',
            'Não é possível gerar link para este contrato.',
            'id',
          );
        }
        if (locked.accepted_version === locked.current_version) {
          throw new ContractError(
            'ALREADY_ACCEPTED',
            'A versão atual do contrato já foi aceita.',
            'id',
          );
        }
        const version = await tx.contractVersion.findUniqueOrThrow({
          where: { uq_cv_contract_version: { contractId: id, version: locked.current_version } },
        });
        await tx.contractAccessToken.updateMany({
          where: { contractId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        const { token, tokenHash } = newAccessToken();
        const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_DAYS * 86_400_000);
        await tx.contractAccessToken.create({
          data: {
            organizationId: orgId,
            contractId: id,
            versionId: version.id,
            tokenHash,
            expiresAt,
            createdBy: memberId,
          },
        });
        await tx.contract.update({
          where: { id },
          data: { status: 'awaiting_acceptance', linkGeneratedAt: new Date() },
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: memberId,
          action: 'contract.link.generate',
          entityType: 'contract',
          entityId: id,
          metadata: { version: locked.current_version },
        });
        return {
          url: `${this.config.frontendUrl.replace(/\/+$/, '')}/aceite/${orgId}/${token}`,
          expiresAt,
          contract: await loadContractView(tx, orgId, id),
          errors: [],
        };
      });
    } catch (e) {
      const m = mapContractError(e);
      if (m) return { url: null, expiresAt: null, contract: null, errors: [m] };
      throw e;
    }
  }

  get(orgId: string, id: string): Promise<ContractView | null> {
    return this.tenant.runWithTenant(orgId, (tx) => loadContractView(tx, orgId, id));
  }

  list(
    orgId: string,
    filter: { status?: string | null; derived?: string | null } = {},
  ): Promise<ContractView[]> {
    return this.tenant.runWithTenant(orgId, (tx) =>
      loadContractViews(tx, orgId, filter.status ? { status: filter.status } : {}, filter.derived),
    );
  }
}
