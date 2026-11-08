import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { syncContractCoverageTx } from "../bridal/bridal-coverage";
import { applyPackageToBrideTx } from "../bridal/bridal-package";
import { mapBridalError } from "../bridal/bridal-errors";
import {
  createBridalGroupTx,
  type BridalPersonInput,
} from "../bridal/bridal.service";
import { prorateServiceUnits } from "../comandas/comanda-items";
import { recordAudit } from "../common/audit-log";
import { fromCents, parseMoneyInput, toCents } from "../common/money";
import { AppConfigService } from "../config/app-config.service";
import { TenantContextService } from "../database/tenant-context.service";
import type { TenantPrismaClient } from "../database/types";
import { nextContractCode } from "./contract-code";
import {
  ContractError,
  mapContractError,
  type ContractUserError,
} from "./contract-errors";
import { lockContract } from "./contract-lock";
import { loadLetterheadTx } from "./contract-letterhead.service";
import type { ContractSnapshot } from "./domain/contract-snapshot";
import {
  buildLiveSnapshotTx,
  loadReadinessInputTx,
  refreshContractVersionTx,
  renderContractVersionTx,
} from "./contract-render";
import {
  formatMissingMessage,
  missingRequiredFields,
  type MissingField,
} from "./domain/contract-required-fields";
import {
  loadContractView,
  loadContractViews,
  localDate,
  type ContractView,
} from "./contract-serialize";
import { loadEffectiveSettings } from "./contract-settings.service";
import { buildPolicySnapshot } from "./domain/cancellation-policy";
import {
  balanceDueDate,
  computeContractTotals,
  computeDepositCents,
  validateInstallments,
  type DepositKind,
} from "./domain/contract-math";
import { ACCESS_TOKEN_TTL_DAYS, newAccessToken } from "./domain/contract-token";

export interface ContractItemInput {
  /** Omitido = noiva/debutante do grupo. */
  groupMemberId?: string | null;
  serviceId: string;
  unitPrice?: string | null;
  quantity?: number | null;
  purpose?: string | null;
  /** true = do pacote; false = adicional; omitido = preserva o vínculo do item existente. */
  packageItem?: boolean | null;
}

export interface InstallmentInput {
  dueDate: string;
  amount: string;
}

/** Grupo criado junto com o contrato (Contratos > Novo contrato). Só a noiva/debutante entra. */
export interface NewContractGroupInput {
  eventKind?: string | null;
  eventDate: string;
  name?: string | null;
  eventTime?: string | null;
  readyBy?: Date | string | null;
  locationKind?: string | null;
  locationAddress?: string | null;
  locationName?: string | null;
  notes?: string | null;
  bride: BridalPersonInput;
  responsibleClientId?: string | null;
  newResponsible?: { fullName: string; phone?: string | null } | null;
}

export interface CreateContractInput {
  /** Grupo existente; exclusivo com newGroup. */
  groupId?: string | null;
  newGroup?: NewContractGroupInput | null;
  packageId?: string | null;
  items?: ContractItemInput[] | null;
  discountAmount?: string | null;
  depositAmount?: string | null;
  balanceDueDaysBefore?: number | null;
  paymentMode?: string | null;
  discountDescription?: string | null;
  installments?: InstallmentInput[] | null;
}

export type UpdateContractInput = Omit<
  CreateContractInput,
  "groupId" | "newGroup"
>;

/** Prévia: as formas do create (groupId/newGroup) ou a edição de um rascunho (contractId). */
export interface ContractPreviewInput extends CreateContractInput {
  /** Exclusivo com groupId/newGroup; os dados do input sobrepõem o contrato. */
  contractId?: string | null;
}

export interface ContractPreviewData {
  snapshot: ContractSnapshot;
  letterhead: Buffer | null;
  orgName: string;
}

export type ContractPreviewResult =
  | ContractPreviewData
  | { errors: ContractUserError[] };

/** Código que aparece no snapshot da prévia (não consome número). */
export const PREVIEW_CODE = "PRÉVIA";

type TxMode = "commit" | "preview";

/** Erro sentinela: carrega o resultado da prévia para fora e força o rollback. */
class PreviewRollback extends Error {
  constructor(readonly result: ContractPreviewData) {
    super("contract-preview-rollback");
  }
}

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
  purpose: "event" | "trial";
  /** Teste incluso no pacote: o valor é cobrado na comanda do evento (261108-n2o). */
  settledAtEvent: boolean;
}

interface ExistingItem {
  groupMemberId: string;
  serviceId: string;
  packageId: string | null;
  purpose: string;
  settledAtEvent: boolean;
}

type GroupWithMembers = NonNullable<Awaited<ReturnType<typeof loadGroup>>>;

const EDITABLE = ["draft", "awaiting_acceptance", "active"];
const MAX_QUANTITY = 99;

function loadGroup(tx: TenantPrismaClient, groupId: string) {
  return tx.bridalGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        orderBy: { sortOrder: "asc" },
        include: {
          services: {
            orderBy: { sortOrder: "asc" },
            include: { service: true },
          },
        },
      },
    },
  });
}

function parseCents(
  v: string | null | undefined,
  field: string,
  fallback: number | null,
) {
  if (v == null) return fallback;
  const cents = parseMoneyInput(v);
  if (cents === null) {
    throw new ContractError(
      "INVALID_AMOUNT",
      "Valor monetário inválido.",
      field,
    );
  }
  return cents;
}

function checkDays(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 365) {
    throw new ContractError(
      "INVALID_DAYS",
      "O prazo do restante deve ficar entre 0 e 365 dias antes do evento.",
      "balanceDueDaysBefore",
    );
  }
  return n;
}

async function buildItems(
  tx: TenantPrismaClient,
  group: GroupWithMembers,
  items: ContractItemInput[] | null | undefined,
  packageId: string | null,
  existingItems: ExistingItem[] = [],
): Promise<ItemDraft[]> {
  const covered = group.members.filter((m) => m.coveredByContract);

  // 1. itens explícitos
  if (items && items.length > 0) {
    const serviceIds = [...new Set(items.map((i) => i.serviceId))];
    const services = await tx.service.findMany({
      where: { id: { in: serviceIds }, deletedAt: null },
    });
    const byId = new Map(services.map((s) => [s.id, s]));
    const pool = [...existingItems];
    return items.map((it) => {
      const member = it.groupMemberId
        ? group.members.find((m) => m.id === it.groupMemberId)
        : group.members.find((m) => m.role === "bride");
      if (!member) {
        throw new ContractError(
          "MEMBER_NOT_FOUND",
          "Pessoa não pertence ao grupo.",
          "items",
        );
      }
      if (!member.coveredByContract) {
        throw new ContractError(
          "MEMBER_NOT_COVERED",
          "Esta pessoa não está coberta pelo contrato.",
          "items",
        );
      }
      const service = byId.get(it.serviceId);
      if (!service) {
        throw new ContractError(
          "SERVICE_NOT_FOUND",
          "Serviço não encontrado.",
          "items",
        );
      }
      const quantity = it.quantity ?? 1;
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_QUANTITY
      ) {
        throw new ContractError(
          "INVALID_QUANTITY",
          "Quantidade inválida.",
          "items",
        );
      }
      const purpose = it.purpose ?? "event";
      if (purpose !== "event" && purpose !== "trial") {
        throw new ContractError(
          "INVALID_PURPOSE",
          "Finalidade inválida.",
          "items",
        );
      }
      // vínculo com o pacote: true/false explícitos; omitido preserva o item existente
      const idx = pool.findIndex(
        (e) =>
          e.groupMemberId === member.id &&
          e.serviceId === service.id &&
          e.purpose === purpose &&
          (it.packageItem === false
            ? e.packageId == null
            : e.packageId != null),
      );
      const fallbackIdx =
        idx >= 0
          ? idx
          : pool.findIndex(
              (e) =>
                e.groupMemberId === member.id &&
                e.serviceId === service.id &&
                e.purpose === purpose,
            );
      const matched = fallbackIdx >= 0 ? pool.splice(fallbackIdx, 1)[0] : null;
      let itemPackageId: string | null;
      if (it.packageItem === true) {
        if (!packageId) {
          throw new ContractError(
            "PACKAGE_ITEM_WITHOUT_PACKAGE",
            "Item marcado como do pacote, mas o contrato não tem pacote.",
            "items",
          );
        }
        itemPackageId = packageId;
      } else if (it.packageItem === false) {
        itemPackageId = null;
      } else {
        // preserva só se o vínculo antigo ainda é o pacote final do contrato
        itemPackageId =
          matched?.packageId && matched.packageId === packageId
            ? packageId
            : null;
      }
      // teste incluso só continua incluso se seguir ligado ao pacote do contrato
      const settledAtEvent =
        purpose === "trial" &&
        itemPackageId != null &&
        !!matched?.settledAtEvent;
      return {
        groupMemberId: member.id,
        serviceId: service.id,
        packageId: itemPackageId,
        description: settledAtEvent
          ? `${service.name} — teste incluso, pago no evento`
          : service.name,
        quantity,
        unitCents: parseCents(
          it.unitPrice,
          "items",
          toCents(service.basePrice),
        ) as number,
        purpose,
        settledAtEvent,
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
        purpose: (s.purpose === "trial" ? "trial" : "event") as
          | "event"
          | "trial",
        settledAtEvent: false,
      })),
    );

  // 2. pacote: itens da noiva rateados + planejados das demais pessoas cobertas
  if (packageId) {
    const pkg = await tx.package.findFirst({
      where: { id: packageId, deletedAt: null },
      include: {
        services: {
          orderBy: { displayOrder: "asc" },
          include: { service: true },
        },
      },
    });
    if (!pkg)
      throw new ContractError(
        "PACKAGE_NOT_FOUND",
        "Pacote não encontrado.",
        "packageId",
      );
    const bride = group.members.find((m) => m.role === "bride");
    if (!bride)
      throw new ContractError(
        "MEMBER_NOT_FOUND",
        "Grupo sem noiva.",
        "groupId",
      );
    const units = pkg.services.flatMap((ps) =>
      Array.from({ length: ps.quantity }, () => ({
        service: ps.service,
        includesTrial: ps.includesTrial,
      })),
    );
    const charged = await prorateServiceUnits(
      tx,
      units.map((u) => ({
        listCents: toCents(u.service.basePrice),
        service: u.service,
      })),
      toCents(pkg.price),
    );
    // Teste incluso (261108-n2o): o valor rateado da unidade vira metade evento + metade
    // teste, com o centavo ímpar no evento. A soma continua igual ao preço do pacote.
    const brideItems: ItemDraft[] = units.flatMap((u, i) => {
      const s = u.service;
      const base = {
        groupMemberId: bride.id,
        serviceId: s.id,
        packageId: pkg.id,
        quantity: 1,
      };
      const name = `${s.name} (pacote ${pkg.name})`;
      if (!u.includesTrial) {
        return [
          {
            ...base,
            description: name,
            unitCents: charged[i],
            purpose: "event" as const,
            settledAtEvent: false,
          },
        ];
      }
      const trialCents = Math.floor(charged[i] / 2);
      return [
        {
          ...base,
          description: name,
          unitCents: charged[i] - trialCents,
          purpose: "event" as const,
          settledAtEvent: false,
        },
        {
          ...base,
          description: `${name} — teste incluso, pago no evento`,
          unitCents: trialCents,
          purpose: "trial" as const,
          settledAtEvent: true,
        },
      ];
    });
    return [
      ...brideItems,
      ...planned(covered.filter((m) => m.role !== "bride")),
    ];
  }

  // 3. serviços planejados de todas as pessoas cobertas
  return planned(covered);
}

function parseDiscountDescription(
  v: string | null | undefined,
): string | null | undefined {
  if (v === undefined) return undefined;
  const t = (v ?? "").trim();
  if (t.length > 120) {
    throw new ContractError(
      "INVALID_DISCOUNT_DESCRIPTION",
      "Descrição do desconto muito longa (máx. 120).",
      "discountDescription",
    );
  }
  return t === "" ? null : t;
}

interface ResolvedInstallments {
  mode: string;
  depositCents: number;
  installments: { dueDate: string; cents: number }[];
}

/**
 * Forma de pagamento + parcelas do sinal (D-07, D-12). `current` = estado atual
 * do contrato no update (null no create).
 */
function resolveInstallments(args: {
  inputMode: string | null | undefined;
  inputInstallments: InstallmentInput[] | null | undefined;
  current: {
    paymentMode: string;
    installments: { dueDate: string; cents: number }[];
  } | null;
  totalCents: number;
  depositCents: number;
  /** sinal informado pela usuária (confere a soma das parcelas ±1 centavo); null = vale a soma. */
  explicitDepositCents: number | null;
  today: string;
}): ResolvedInstallments {
  const { current, totalCents, today } = args;
  const mode = args.inputMode ?? current?.paymentMode ?? "sinal";
  const firstDue = current?.installments[0]?.dueDate ?? today;
  const parsed = args.inputInstallments
    ? args.inputInstallments.map((i) => ({
        dueDate: i.dueDate,
        cents: parseCents(i.amount, "installments", 0) as number,
      }))
    : null;

  if (mode === "a_vista") {
    const list = parsed ?? [{ dueDate: firstDue, cents: totalCents }];
    validateInstallments(mode, list, totalCents, totalCents);
    return { mode, depositCents: totalCents, installments: list };
  }
  if (parsed) {
    const sum = parsed.reduce((a, i) => a + i.cents, 0);
    validateInstallments(
      mode,
      parsed,
      args.explicitDepositCents ?? sum,
      totalCents,
    );
    return { mode, depositCents: sum, installments: parsed };
  }
  if (mode === "sinal") {
    return {
      mode,
      depositCents: args.depositCents,
      installments:
        args.depositCents > 0
          ? [{ dueDate: firstDue, cents: args.depositCents }]
          : [],
    };
  }
  // sinal_parcelado sem parcelas novas: mantém as atuais se ainda fecham com o sinal
  const kept = current?.installments ?? [];
  validateInstallments(mode, kept, args.depositCents, totalCents);
  return { mode, depositCents: args.depositCents, installments: kept };
}

async function orgToday(
  tx: TenantPrismaClient,
  orgId: string,
): Promise<string> {
  const org = await tx.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  return localDate(new Date(), org?.timezone ?? "America/Sao_Paulo");
}

async function replaceInstallmentsTx(
  tx: TenantPrismaClient,
  orgId: string,
  contractId: string,
  list: { dueDate: string; cents: number }[],
): Promise<void> {
  await tx.contractDepositInstallment.deleteMany({ where: { contractId } });
  if (list.length === 0) return;
  await tx.contractDepositInstallment.createMany({
    data: list.map((i, idx) => ({
      organizationId: orgId,
      contractId,
      seq: idx + 1,
      amount: fromCents(i.cents),
      dueDate: new Date(`${i.dueDate}T00:00:00.000Z`),
    })),
  });
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
    const b = mapBridalError(e);
    if (b) return { contract: null, errors: [b] };
    throw e;
  }

  /** Nome automático do grupo: 'Noiva <nome>' / 'Debutante <nome>'. */
  private async autoGroupName(
    tx: TenantPrismaClient,
    ng: NewContractGroupInput,
  ): Promise<string> {
    const given = ng.name?.trim();
    if (given) return given;
    let who = "";
    if (ng.bride.clientId) {
      const c = await tx.client.findFirst({
        where: { id: ng.bride.clientId },
        select: { fullName: true },
      });
      who = c?.fullName?.trim() ?? "";
    } else if (ng.bride.newClient) {
      who = ng.bride.newClient.fullName?.trim() ?? "";
    }
    if (!who) return "";
    return `${ng.eventKind === "debutante" ? "Debutante" : "Noiva"} ${who}`.slice(
      0,
      160,
    );
  }

  async create(
    orgId: string,
    memberId: string,
    input: CreateContractInput,
  ): Promise<ContractPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const id = await this.createTx(tx, orgId, memberId, input);
        return { contract: await loadContractView(tx, orgId, id), errors: [] };
      });
    } catch (e) {
      return this.fail(e);
    }
  }

  /**
   * Corpo do create (grava tudo no `tx`). `mode: 'preview'` = mesma regra, mas sem
   * consumir número de contrato, sem exigir itens e sem auditoria; quem chama desfaz
   * a transação (ver preview()).
   */
  private async createTx(
    tx: TenantPrismaClient,
    orgId: string,
    memberId: string,
    input: CreateContractInput,
    mode: TxMode = "commit",
  ): Promise<string> {
    if (!!input.groupId === !!input.newGroup) {
      throw new ContractError(
        "GROUP_REQUIRED",
        "Informe o grupo ou os dados da noiva para o contrato.",
        "groupId",
      );
    }
    const ng = input.newGroup ?? null;
    let groupId = input.groupId as string;
    if (ng) {
      groupId = await createBridalGroupTx(tx, orgId, memberId, {
        group: {
          name: await this.autoGroupName(tx, ng),
          eventDate: ng.eventDate,
          eventKind: ng.eventKind,
          eventTime: ng.eventTime,
          readyBy: ng.readyBy,
          locationKind: ng.locationKind,
          locationAddress: ng.locationAddress,
          locationName: ng.locationName,
          notes: ng.notes,
          responsibleClientId: ng.responsibleClientId,
          newResponsible: ng.newResponsible,
          // pacote: aplicado por syncGroupPackageTx no fim, para não aplicar duas vezes
        },
        bride: { ...ng.bride, coveredByContract: true },
        companions: [],
      });
    }
    const group = await loadGroup(tx, groupId);
    if (!group)
      throw new ContractError(
        "GROUP_NOT_FOUND",
        "Grupo não encontrado.",
        "groupId",
      );
    if (group.status !== "active") {
      throw new ContractError(
        "GROUP_NOT_ACTIVE",
        "O grupo não está ativo.",
        "groupId",
      );
    }
    const live = await tx.contract.findFirst({
      where: { bridalGroupId: group.id, status: { not: "cancelled" } },
      select: { id: true },
    });
    if (live) {
      throw new ContractError(
        "GROUP_HAS_CONTRACT",
        "Este grupo já possui um contrato ativo.",
        "groupId",
      );
    }
    const bride = group.members.find((m) => m.role === "bride");
    if (!bride)
      throw new ContractError(
        "MEMBER_NOT_FOUND",
        "Grupo sem noiva.",
        "groupId",
      );

    const pkg = input.packageId
      ? await tx.package.findFirst({
          where: { id: input.packageId, deletedAt: null },
        })
      : null;
    if (input.packageId && !pkg) {
      throw new ContractError(
        "PACKAGE_NOT_FOUND",
        "Pacote não encontrado.",
        "packageId",
      );
    }

    const drafts = await buildItems(
      tx,
      group,
      input.items,
      pkg?.id ?? null,
      [],
    );
    if (drafts.length === 0 && mode === "commit") {
      throw new ContractError(
        "ITEMS_REQUIRED",
        "Adicione ao menos um item.",
        "items",
      );
    }
    const itemsCents = drafts.map((d) => d.unitCents * d.quantity);
    const discountCents = parseCents(
      input.discountAmount,
      "discountAmount",
      0,
    ) as number;
    const { totalCents } = computeContractTotals({
      itemsCents,
      discountCents,
      depositCents: 0,
    });
    const explicitDeposit = parseCents(
      input.depositAmount,
      "depositAmount",
      null,
    );
    const depositCents =
      explicitDeposit ??
      computeDepositCents(
        (pkg?.depositKind as DepositKind | null) ?? null,
        pkg?.depositValue?.toString() ?? null,
        totalCents,
      );
    const today = await orgToday(tx, orgId);
    const plan = resolveInstallments({
      inputMode: input.paymentMode,
      inputInstallments: input.installments,
      current: null,
      totalCents,
      depositCents,
      explicitDepositCents: explicitDeposit,
      today,
    });
    const totals = computeContractTotals({
      itemsCents,
      discountCents,
      depositCents: plan.depositCents,
    });
    const discountDescription =
      parseDiscountDescription(input.discountDescription) ?? null;

    const settings = await loadEffectiveSettings(tx, orgId);
    const days = checkDays(
      input.balanceDueDaysBefore ?? settings.balanceDueDaysBefore,
    );
    const eventDate = group.eventDate.toISOString().slice(0, 10);
    const dueDate = balanceDueDate(eventDate, days);
    // Prévia: código descartável (o UPSERT em contract_sequences travaria a linha da
    // org/ano até o fim da transação e serializaria com criações reais).
    const code =
      mode === "preview"
        ? `PRV-${randomBytes(6).toString("hex")}`
        : await nextContractCode(tx, orgId, group.eventDate.getUTCFullYear());

    const contract = await tx.contract.create({
      data: {
        organizationId: orgId,
        code,
        bridalGroupId: group.id,
        brideClientId: bride.clientId,
        contractorClientId:
          group.eventKind === "debutante" ? group.responsibleClientId : null,
        paymentMode: plan.mode,
        discountDescription,
        packageId: pkg?.id ?? null,
        status: "draft",
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
            settledAtEvent: d.settledAtEvent,
            sortOrder: i,
          })),
        },
      },
    });
    await replaceInstallmentsTx(tx, orgId, contract.id, plan.installments);
    await renderContractVersionTx(tx, orgId, contract.id, memberId);
    if (mode === "commit") {
      await recordAudit(tx, {
        orgId,
        actorMemberId: memberId,
        action: "contract.create",
        entityType: "contract",
        entityId: contract.id,
        metadata: {
          code,
          totalCents: totals.totalCents,
          depositCents: totals.depositCents,
          ...(ng ? { groupCreated: true } : {}),
        },
      });
    }
    if (ng && !pkg) {
      // sem pacote: a noiva ganha os serviços planejados dos itens (agenda do evento)
      const seen = new Set<string>();
      const rows: { serviceId: string; purpose: string }[] = [];
      for (const d of drafts) {
        const k = `${d.serviceId}|${d.purpose}`;
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push({ serviceId: d.serviceId, purpose: d.purpose });
      }
      await tx.bridalMemberService.createMany({
        data: rows.map((r, i) => ({
          organizationId: orgId,
          groupMemberId: bride.id,
          serviceId: r.serviceId,
          purpose: r.purpose,
          sortOrder: i,
        })),
      });
    }
    await syncGroupPackageTx(tx, orgId, group.id, pkg?.id ?? null);
    await syncContractCoverageTx(tx, orgId, group.id);
    return contract.id;
  }

  async update(
    orgId: string,
    memberId: string,
    id: string,
    input: UpdateContractInput,
  ): Promise<ContractPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        await this.updateTx(tx, orgId, memberId, id, input);
        return { contract: await loadContractView(tx, orgId, id), errors: [] };
      });
    } catch (e) {
      return this.fail(e);
    }
  }

  /** Corpo do update (grava tudo no `tx`). `mode: 'preview'`: aceita itens vazios e não audita. */
  private async updateTx(
    tx: TenantPrismaClient,
    orgId: string,
    memberId: string,
    id: string,
    input: UpdateContractInput,
    mode: TxMode = "commit",
  ): Promise<string> {
    const locked = await lockContract(tx, id);
    if (!EDITABLE.includes(locked.status)) {
      throw new ContractError(
        "CONTRACT_NOT_EDITABLE",
        "Este contrato não pode mais ser editado.",
        "id",
      );
    }
    const current = await tx.contract.findUniqueOrThrow({ where: { id } });
    const group = await loadGroup(tx, current.bridalGroupId);
    if (!group)
      throw new ContractError(
        "GROUP_NOT_FOUND",
        "Grupo não encontrado.",
        "groupId",
      );

    let packageId = current.packageId;
    let pkg: Awaited<ReturnType<typeof tx.package.findFirst>> = null;
    if (input.packageId !== undefined) {
      packageId = input.packageId;
      if (packageId) {
        pkg = await tx.package.findFirst({
          where: { id: packageId, deletedAt: null },
        });
        if (!pkg) {
          throw new ContractError(
            "PACKAGE_NOT_FOUND",
            "Pacote não encontrado.",
            "packageId",
          );
        }
      }
    }

    const existing = await tx.contractItem.findMany({
      where: { contractId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    let itemsCents: number[];
    let drafts: ItemDraft[] | null = null;
    if (input.items && input.items.length > 0) {
      drafts = await buildItems(tx, group, input.items, packageId, existing);
      itemsCents = drafts.map((d) => d.unitCents * d.quantity);
    } else if (input.items && mode === "preview") {
      drafts = [];
      itemsCents = [];
    } else if (input.items) {
      throw new ContractError(
        "ITEMS_REQUIRED",
        "Adicione ao menos um item.",
        "items",
      );
    } else {
      itemsCents = existing.map((e) => toCents(e.total));
    }

    const discountCents = parseCents(
      input.discountAmount,
      "discountAmount",
      toCents(current.discountAmount),
    ) as number;
    const explicitDeposit = parseCents(
      input.depositAmount,
      "depositAmount",
      null,
    );
    const depositCents = explicitDeposit ?? toCents(current.depositAmount);
    const { totalCents } = computeContractTotals({
      itemsCents,
      discountCents,
      depositCents: 0,
    });
    const currentInstallments = await tx.contractDepositInstallment.findMany({
      where: { contractId: id },
      orderBy: { seq: "asc" },
    });
    const plan = resolveInstallments({
      inputMode: input.paymentMode,
      inputInstallments: input.installments,
      current: {
        paymentMode: current.paymentMode,
        installments: currentInstallments.map((i) => ({
          dueDate: i.dueDate.toISOString().slice(0, 10),
          cents: toCents(i.amount),
        })),
      },
      totalCents,
      depositCents,
      explicitDepositCents: explicitDeposit,
      today: await orgToday(tx, orgId),
    });
    const totals = computeContractTotals({
      itemsCents,
      discountCents,
      depositCents: plan.depositCents,
    });
    const discountDescription = parseDiscountDescription(
      input.discountDescription,
    );

    const paid = await tx.contractPayment.aggregate({
      where: { contractId: id },
      _sum: { amount: true },
    });
    const paidCents = toCents(paid._sum.amount ?? 0);
    if (totals.totalCents < paidCents) {
      throw new ContractError(
        "TOTAL_BELOW_PAID",
        "O novo total é menor que o valor já pago.",
        "discountAmount",
      );
    }

    const days = checkDays(
      input.balanceDueDaysBefore ?? current.balanceDueDaysBefore,
    );
    // sempre a partir da data atual do evento (o evento pode ter sido remarcado)
    const dueDate = balanceDueDate(
      group.eventDate.toISOString().slice(0, 10),
      days,
    );

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
          settledAtEvent: d.settledAtEvent,
          sortOrder: i,
        })),
      });
    }
    await tx.contract.update({
      where: { id },
      data: {
        packageId,
        paymentMode: plan.mode,
        ...(discountDescription !== undefined ? { discountDescription } : {}),
        contractorClientId:
          group.eventKind === "debutante" ? group.responsibleClientId : null,
        itemsTotal: fromCents(totals.itemsTotalCents),
        discountAmount: fromCents(discountCents),
        totalAmount: fromCents(totals.totalCents),
        depositAmount: fromCents(totals.depositCents),
        balanceDueDaysBefore: days,
        balanceDueDate: new Date(`${dueDate}T00:00:00.000Z`),
        status: locked.status === "draft" ? "draft" : "awaiting_acceptance",
      },
    });
    await replaceInstallmentsTx(tx, orgId, id, plan.installments);
    const v = await renderContractVersionTx(tx, orgId, id, memberId);
    await tx.contractAccessToken.updateMany({
      where: { contractId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (mode === "commit") {
      await recordAudit(tx, {
        orgId,
        actorMemberId: memberId,
        action: "contract.update",
        entityType: "contract",
        entityId: id,
        metadata: { version: v.version },
      });
    }
    await syncGroupPackageTx(
      tx,
      orgId,
      current.bridalGroupId,
      packageId,
      current.packageId,
    );
    await syncContractCoverageTx(tx, orgId, current.bridalGroupId);
    return id;
  }

  /**
   * Prévia (quick 261105-d6k): roda o MESMO createTx/updateTx dentro de runWithTenant,
   * monta o snapshot e lança PreviewRollback — o Prisma desfaz a transação inteira.
   * Seguro porque todos os efeitos de create/update ficam no `tx` (grupo, cliente nova,
   * itens, parcelas, versões, cobertura); nada sai da transação (sem e-mail, fila ou
   * eventos). O código do contrato é descartável e a auditoria é pulada.
   */
  async preview(
    orgId: string,
    memberId: string,
    input: ContractPreviewInput,
  ): Promise<ContractPreviewResult> {
    try {
      const targets = [input.contractId, input.groupId, input.newGroup].filter(
        (v) => v != null && v !== "",
      ).length;
      if (targets !== 1) {
        throw new ContractError(
          "GROUP_REQUIRED",
          "Informe o grupo ou os dados da noiva para o contrato.",
          "groupId",
        );
      }
      await this.tenant.runWithTenant(orgId, async (tx) => {
        const id = input.contractId
          ? await this.updateTx(
              tx,
              orgId,
              memberId,
              input.contractId,
              {
                packageId: input.packageId,
                items: input.items,
                discountAmount: input.discountAmount,
                depositAmount: input.depositAmount,
                balanceDueDaysBefore: input.balanceDueDaysBefore,
                paymentMode: input.paymentMode,
                discountDescription: input.discountDescription,
                installments: input.installments,
              },
              "preview",
            )
          : await this.createTx(tx, orgId, memberId, input, "preview");
        const live = await buildLiveSnapshotTx(tx, orgId, id);
        const letterhead = live.snapshot.letterhead
          ? ((await loadLetterheadTx(tx, live.snapshot.letterhead.sha256))
              ?.data ?? null)
          : null;
        const org = await tx.organization.findUnique({
          where: { id: orgId },
          select: { tradeName: true },
        });
        throw new PreviewRollback({
          snapshot: { ...live.snapshot, code: PREVIEW_CODE },
          letterhead,
          orgName: org?.tradeName ?? "",
        });
      });
      throw new Error("contract preview: transaction finished without result");
    } catch (e) {
      if (e instanceof PreviewRollback) return e.result;
      const m = mapContractError(e) ?? mapBridalError(e);
      if (m) return { errors: [m] };
      throw e;
    }
  }

  async generateLink(
    orgId: string,
    memberId: string,
    id: string,
  ): Promise<ContractLinkPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const locked = await lockContract(tx, id);
        if (!EDITABLE.includes(locked.status)) {
          throw new ContractError(
            "CONTRACT_NOT_EDITABLE",
            "Não é possível gerar link para este contrato.",
            "id",
          );
        }
        if (locked.accepted_version === locked.current_version) {
          throw new ContractError(
            "ALREADY_ACCEPTED",
            "A versão atual do contrato já foi aceita.",
            "id",
          );
        }
        const missing = missingRequiredFields(
          await loadReadinessInputTx(tx, orgId, id),
        );
        if (missing.length > 0) {
          throw new ContractError(
            "CONTRACT_INCOMPLETE",
            formatMissingMessage(missing),
            "missing",
          );
        }
        // D-18: versão legada ou desatualizada ganha versão nova no layout novo.
        const refreshed = await refreshContractVersionTx(
          tx,
          orgId,
          id,
          memberId,
        );
        const version = await tx.contractVersion.findUniqueOrThrow({
          where: {
            uq_cv_contract_version: {
              contractId: id,
              version: refreshed.version,
            },
          },
        });
        await tx.contractAccessToken.updateMany({
          where: { contractId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        const { token, tokenHash } = newAccessToken();
        const expiresAt = new Date(
          Date.now() + ACCESS_TOKEN_TTL_DAYS * 86_400_000,
        );
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
          data: { status: "awaiting_acceptance", linkGeneratedAt: new Date() },
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: memberId,
          action: "contract.link.generate",
          entityType: "contract",
          entityId: id,
          metadata: { version: refreshed.version },
        });
        return {
          url: `${this.config.frontendUrl.replace(/\/+$/, "")}/aceite/${orgId}/${token}`,
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

  readiness(
    orgId: string,
    id: string,
  ): Promise<{ ready: boolean; missing: MissingField[] }> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const missing = missingRequiredFields(
        await loadReadinessInputTx(tx, orgId, id),
      );
      return { ready: missing.length === 0, missing };
    });
  }

  get(orgId: string, id: string): Promise<ContractView | null> {
    return this.tenant.runWithTenant(orgId, (tx) =>
      loadContractView(tx, orgId, id),
    );
  }

  list(
    orgId: string,
    filter: { status?: string | null; derived?: string | null } = {},
  ): Promise<ContractView[]> {
    return this.tenant.runWithTenant(orgId, (tx) =>
      loadContractViews(
        tx,
        orgId,
        filter.status ? { status: filter.status } : {},
        filter.derived,
      ),
    );
  }
}
