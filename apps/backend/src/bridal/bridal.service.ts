import { BadRequestException, Injectable } from "@nestjs/common";
import { recordAudit } from "../common/audit-log";
import { TenantContextService } from "../database/tenant-context.service";
import type { TenantPrismaClient } from "../database/types";
import { syncContractCoverageTx } from "./bridal-coverage";
import { applyPackageToBrideTx } from "./bridal-package";
import {
  BRIDAL_SCHEDULE_TX_OPTIONS,
  cancelGroupAppointmentsTx,
  createBridalScheduleTx,
  rebuildTravelBlocksTx,
  type BridalScheduleInput,
} from "./bridal-schedule";
import { resolvePersonClientTx, type BridalPersonRef } from "./bridal-clients";
import {
  BridalError,
  mapBridalError,
  type BridalUserError,
} from "./bridal-errors";
import {
  BRIDAL_APPOINTMENT_INCLUDE,
  BRIDAL_GROUP_INCLUDE,
  serializeBridalGroup,
  type BridalGroupRow,
} from "./bridal-serialize";

export interface BridalGroupFieldsInput {
  name: string;
  eventDate: string;
  readyBy?: Date | string | null;
  locationKind?: string | null;
  locationAddress?: string | null;
  travelMinutesBefore?: number | null;
  travelMinutesAfter?: number | null;
  notes?: string | null;
  /** undefined = mantém; null = limpa; string = pacote do catálogo */
  packageId?: string | null;
  /** noiva (padrão) | debutante; omitido no update = mantém */
  eventKind?: string | null;
  /** Só debutante. undefined = mantém; null = remove */
  responsibleClientId?: string | null;
  /** Cadastra a responsável na hora (só debutante) */
  newResponsible?: { fullName: string; phone?: string | null } | null;
  /** HH:MM; vazio = sem horário */
  eventTime?: string | null;
  locationName?: string | null;
}

export interface BridalMemberServiceInput {
  serviceId: string;
  purpose?: string | null;
}

export interface BridalPersonInput extends BridalPersonRef {
  relationLabel?: string | null;
  coveredByContract?: boolean | null;
  services?: BridalMemberServiceInput[] | null;
}

export interface CreateBridalGroupInput {
  group: BridalGroupFieldsInput;
  bride: BridalPersonInput;
  companions?: BridalPersonInput[] | null;
}

export interface BridalSchedulePayload {
  group: BridalGroupView | null;
  appointmentIds: string[];
  errors: BridalUserError[];
}

export type BridalGroupView = ReturnType<typeof serializeBridalGroup>;

export interface BridalGroupPayload {
  group: BridalGroupView | null;
  errors: BridalUserError[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EVENT_KINDS = ["noiva", "debutante"];
const MAX_PEOPLE = 15;
const MAX_SERVICES_PER_PERSON = 10;
const MAX_TRAVEL_MINUTES = 240;
/** Status de agendamento que "ocupam" o membro (bloqueiam remoção e contam no grupo). */
const BLOCKING_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
];
const LIST_LIMIT = 200;

const fail = (e: unknown): BridalGroupPayload => {
  const m = mapBridalError(e);
  if (m) return { group: null, errors: [m] };
  throw e;
};

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

interface ValidatedFields {
  name: string;
  eventDate: Date;
  readyBy: Date | null;
  locationKind: string;
  locationAddress: string | null;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
  notes: string | null;
  eventKind: string;
  eventTime: string | null;
  locationName: string | null;
}

async function validateGroupFields(
  tx: TenantPrismaClient,
  orgId: string,
  input: BridalGroupFieldsInput,
  currentKind: string = "noiva",
): Promise<ValidatedFields> {
  const name = input.name?.trim() ?? "";
  if (name.length < 2 || name.length > 160) {
    throw new BridalError(
      "INVALID_NAME",
      "Informe o nome do evento (2 a 160 caracteres).",
      "name",
    );
  }
  if (!input.eventDate || !isValidDate(input.eventDate)) {
    throw new BridalError(
      "INVALID_EVENT_DATE",
      "Data do evento inválida.",
      "eventDate",
    );
  }
  const locationKind = input.locationKind ?? "studio";
  if (locationKind !== "studio" && locationKind !== "external") {
    throw new BridalError(
      "INVALID_LOCATION",
      "Local do evento inválido.",
      "locationKind",
    );
  }
  const eventKind = input.eventKind ?? currentKind;
  if (!EVENT_KINDS.includes(eventKind)) {
    throw new BridalError(
      "INVALID_EVENT_KIND",
      "Tipo de evento inválido.",
      "eventKind",
    );
  }
  const eventTime = input.eventTime?.trim() || null;
  if (eventTime && !TIME_RE.test(eventTime)) {
    throw new BridalError(
      "INVALID_EVENT_TIME",
      "Horário do evento inválido (use HH:MM).",
      "eventTime",
    );
  }
  let locationName = input.locationName?.trim() || null;
  if (locationName && locationName.length > 160) {
    throw new BridalError(
      "INVALID_LOCATION_NAME",
      "Nome do local muito longo (máx. 160).",
      "locationName",
    );
  }
  let address = input.locationAddress?.trim() || null;
  if (locationKind === "studio" && (!locationName || !address)) {
    // D-11: no estúdio, vazio assume os dados do studio das configurações
    const settings = await tx.contractSettings.findUnique({
      where: { organizationId: orgId },
      select: { studioName: true, studioAddress: true },
    });
    locationName = locationName ?? settings?.studioName?.trim() ?? null;
    address = address ?? settings?.studioAddress?.trim() ?? null;
  }
  if (locationKind === "external" && !address) {
    throw new BridalError(
      "ADDRESS_REQUIRED",
      "Informe o endereço do local externo.",
      "locationAddress",
    );
  }
  let before = input.travelMinutesBefore ?? 0;
  let after = input.travelMinutesAfter ?? 0;
  for (const [v, field] of [
    [before, "travelMinutesBefore"],
    [after, "travelMinutesAfter"],
  ] as const) {
    if (!Number.isInteger(v) || v < 0 || v > MAX_TRAVEL_MINUTES) {
      throw new BridalError(
        "INVALID_TRAVEL",
        `O deslocamento deve ficar entre 0 e ${MAX_TRAVEL_MINUTES} minutos.`,
        field,
      );
    }
  }
  if (locationKind === "studio") {
    before = 0;
    after = 0;
  }
  let readyBy: Date | null = null;
  if (input.readyBy) {
    readyBy = new Date(input.readyBy);
    if (Number.isNaN(readyBy.getTime())) {
      throw new BridalError(
        "READY_BY_OUTSIDE_EVENT_DAY",
        'Horário "pronta até" inválido.',
        "readyBy",
      );
    }
    const rows = await tx.$queryRaw<
      { timezone: string }[]
    >`SELECT timezone FROM organizations LIMIT 1`;
    const tz = rows[0]?.timezone ?? "America/Sao_Paulo";
    if (localDate(readyBy, tz) !== input.eventDate) {
      throw new BridalError(
        "READY_BY_OUTSIDE_EVENT_DAY",
        'O horário "pronta até" deve ser no dia do evento.',
        "readyBy",
      );
    }
  }
  return {
    name,
    eventDate: new Date(`${input.eventDate}T00:00:00.000Z`),
    readyBy,
    locationKind,
    locationAddress: address,
    travelMinutesBefore: before,
    travelMinutesAfter: after,
    notes: input.notes?.trim() || null,
    eventKind,
    eventTime,
    locationName,
  };
}

/**
 * Responsável da debutante (D-04): cliente existente ou cadastro rápido.
 * Devolve undefined quando não há alteração (update com campo omitido).
 */
async function resolveResponsibleTx(
  tx: TenantPrismaClient,
  orgId: string,
  input: BridalGroupFieldsInput,
  eventKind: string,
  brideClientId: string | null,
): Promise<string | null | undefined> {
  if (eventKind !== "debutante") return null;
  let id: string | null | undefined;
  if (input.newResponsible) {
    if (input.responsibleClientId) {
      throw new BridalError(
        "CLIENT_REQUIRED",
        "Escolha uma cliente ou cadastre uma nova.",
        "responsibleClientId",
      );
    }
    id = await resolvePersonClientTx(tx, orgId, {
      newClient: input.newResponsible,
    });
  } else if (input.responsibleClientId) {
    const found = await tx.client.findFirst({
      where: { id: input.responsibleClientId, deletedAt: null },
      select: { id: true },
    });
    if (!found) {
      throw new BridalError(
        "RESPONSIBLE_NOT_FOUND",
        "Responsável não encontrada.",
        "responsibleClientId",
      );
    }
    id = found.id;
  } else if (input.responsibleClientId === null) {
    id = null;
  } else {
    return undefined;
  }
  if (id && brideClientId && id === brideClientId) {
    throw new BridalError(
      "RESPONSIBLE_IS_DEBUTANTE",
      "A responsável deve ser outra pessoa.",
      "responsibleClientId",
    );
  }
  return id;
}

async function validateServices(
  tx: TenantPrismaClient,
  services: BridalMemberServiceInput[],
): Promise<{ serviceId: string; purpose: string }[]> {
  if (services.length > MAX_SERVICES_PER_PERSON) {
    throw new BridalError(
      "TOO_MANY_SERVICES",
      `Máximo de ${MAX_SERVICES_PER_PERSON} serviços por pessoa.`,
      "services",
    );
  }
  const normalized = services.map((s) => ({
    serviceId: s.serviceId,
    purpose: s.purpose ?? "event",
  }));
  const seen = new Set<string>();
  for (const s of normalized) {
    if (s.purpose !== "event" && s.purpose !== "trial") {
      throw new BridalError(
        "INVALID_PURPOSE",
        "Finalidade do serviço inválida.",
        "purpose",
      );
    }
    const key = `${s.serviceId}:${s.purpose}`;
    if (seen.has(key)) {
      throw new BridalError(
        "DUPLICATE_SERVICE",
        "Serviço repetido para a mesma pessoa.",
        "services",
      );
    }
    seen.add(key);
  }
  const ids = [...new Set(normalized.map((s) => s.serviceId))];
  if (ids.length > 0) {
    const found = await tx.service.count({
      where: { id: { in: ids }, deletedAt: null },
    });
    if (found !== ids.length) {
      throw new BridalError(
        "SERVICE_NOT_FOUND",
        "Serviço não encontrado.",
        "services",
      );
    }
  }
  return normalized;
}

async function loadGroupRow(
  tx: TenantPrismaClient,
  id: string,
): Promise<BridalGroupRow | null> {
  return tx.bridalGroup.findFirst({
    where: { id },
    include: BRIDAL_GROUP_INCLUDE,
  });
}

async function buildViews(
  tx: TenantPrismaClient,
  rows: BridalGroupRow[],
): Promise<BridalGroupView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const contracts = await tx.contract.findMany({
    where: { bridalGroupId: { in: ids }, status: { not: "cancelled" } },
    select: { id: true, code: true, status: true, bridalGroupId: true },
  });
  const appts = await tx.appointment.findMany({
    where: {
      bridalGroupId: { in: ids },
      status: { in: BLOCKING_APPOINTMENT_STATUSES },
    },
    select: { bridalGroupId: true },
  });
  const closed = await tx.appointment.findMany({
    where: { bridalGroupId: { in: ids }, comanda: { status: "closed" } },
    select: { bridalGroupId: true, clientId: true },
  });
  const details = await tx.appointment.findMany({
    where: { bridalGroupId: { in: ids } },
    include: BRIDAL_APPOINTMENT_INCLUDE,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 1000,
  });
  return rows.map((row) => {
    const contract = contracts.find((c) => c.bridalGroupId === row.id) ?? null;
    return serializeBridalGroup(row, {
      appointments: details.filter((a) => a.bridalGroupId === row.id),
      groupMemberIdByClient: new Map(
        row.members.map((m) => [m.clientId, m.id]),
      ),
      contract,
      appointmentCount: appts.filter((a) => a.bridalGroupId === row.id).length,
      closedComandaClientIds: new Set(
        closed.filter((c) => c.bridalGroupId === row.id).map((c) => c.clientId),
      ),
    });
  });
}

async function viewOf(
  tx: TenantPrismaClient,
  id: string,
): Promise<BridalGroupView> {
  const row = await loadGroupRow(tx, id);
  if (!row) throw new BridalError("NOT_FOUND", "Grupo não encontrado.", "id");
  return (await buildViews(tx, [row]))[0];
}

async function requireActiveGroup(tx: TenantPrismaClient, id: string) {
  const g = await tx.bridalGroup.findFirst({
    where: { id },
    select: { id: true, status: true, eventDate: true },
  });
  if (!g) throw new BridalError("NOT_FOUND", "Grupo não encontrado.", "id");
  if (g.status !== "active") {
    throw new BridalError("GROUP_NOT_ACTIVE", "O grupo não está ativo.", "id");
  }
  return g;
}

async function requireMember(tx: TenantPrismaClient, memberId: string) {
  const m = await tx.bridalGroupMember.findFirst({
    where: { id: memberId },
    select: {
      id: true,
      groupId: true,
      clientId: true,
      role: true,
      coveredByContract: true,
    },
  });
  if (!m)
    throw new BridalError(
      "NOT_FOUND",
      "Pessoa do grupo não encontrada.",
      "memberId",
    );
  return m;
}

async function hasLiveContractItems(
  tx: TenantPrismaClient,
  memberId: string,
): Promise<boolean> {
  const n = await tx.contractItem.count({
    where: {
      groupMemberId: memberId,
      contract: { status: { not: "cancelled" } },
    },
  });
  return n > 0;
}

async function hasClosedComanda(
  tx: TenantPrismaClient,
  groupId: string,
  clientId: string,
): Promise<boolean> {
  const a = await tx.appointment.findFirst({
    where: { bridalGroupId: groupId, clientId, comanda: { status: "closed" } },
    select: { id: true },
  });
  return !!a;
}

async function insertMemberTx(
  tx: TenantPrismaClient,
  orgId: string,
  groupId: string,
  role: "bride" | "companion",
  sortOrder: number,
  person: BridalPersonInput,
  usedClients: Set<string>,
): Promise<void> {
  const services = await validateServices(tx, person.services ?? []);
  const clientId = await resolvePersonClientTx(tx, orgId, person);
  if (usedClients.has(clientId)) {
    throw new BridalError(
      "MEMBER_ALREADY_IN_GROUP",
      "Esta cliente já faz parte do grupo.",
      "clientId",
    );
  }
  usedClients.add(clientId);
  const relationLabel = person.relationLabel?.trim() || null;
  if (relationLabel && relationLabel.length > 60) {
    throw new BridalError(
      "INVALID_RELATION",
      "Relação muito longa (máx. 60).",
      "relationLabel",
    );
  }
  const member = await tx.bridalGroupMember.create({
    data: {
      organizationId: orgId,
      groupId,
      clientId,
      role,
      relationLabel,
      // D-07: noiva coberta por padrão; madrinha paga avulso.
      coveredByContract: person.coveredByContract ?? role === "bride",
      sortOrder,
    },
    select: { id: true },
  });
  if (services.length > 0) {
    await tx.bridalMemberService.createMany({
      data: services.map((s, i) => ({
        organizationId: orgId,
        groupMemberId: member.id,
        serviceId: s.serviceId,
        purpose: s.purpose,
        sortOrder: i,
      })),
    });
  }
}

async function validatePackage(
  tx: TenantPrismaClient,
  orgId: string,
  packageId: string,
): Promise<string> {
  const pkg = await tx.package.findFirst({
    where: { id: packageId, organizationId: orgId, deletedAt: null },
    select: { id: true },
  });
  if (!pkg)
    throw new BridalError(
      "PACKAGE_NOT_FOUND",
      "Pacote não encontrado.",
      "packageId",
    );
  return pkg.id;
}

/** Cria grupo + noiva (+ acompanhantes) dentro da transação do chamador; devolve o id do grupo. */
export async function createBridalGroupTx(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  input: CreateBridalGroupInput,
): Promise<string> {
  const companions = input.companions ?? [];
  if (1 + companions.length > MAX_PEOPLE) {
    throw new BridalError(
      "TOO_MANY_PEOPLE",
      `Máximo de ${MAX_PEOPLE} pessoas por grupo.`,
      "companions",
    );
  }
  const fields = await validateGroupFields(tx, orgId, input.group);
  const packageId = input.group.packageId
    ? await validatePackage(tx, orgId, input.group.packageId)
    : null;
  const group = await tx.bridalGroup.create({
    data: { organizationId: orgId, ...fields, packageId, createdBy: memberId },
    select: { id: true },
  });
  const used = new Set<string>();
  await insertMemberTx(tx, orgId, group.id, "bride", 0, input.bride, used);
  const bride = await tx.bridalGroupMember.findFirstOrThrow({
    where: { groupId: group.id, role: "bride" },
    select: { clientId: true },
  });
  const responsibleId = await resolveResponsibleTx(
    tx,
    orgId,
    input.group,
    fields.eventKind,
    bride.clientId,
  );
  if (responsibleId) {
    await tx.bridalGroup.update({
      where: { id: group.id },
      data: { responsibleClientId: responsibleId },
    });
  }
  if (packageId) await applyPackageToBrideTx(tx, orgId, group.id, packageId);
  let order = 1;
  for (const c of companions) {
    await insertMemberTx(tx, orgId, group.id, "companion", order++, c, used);
  }
  return group.id;
}

@Injectable()
export class BridalService {
  constructor(private readonly tenant: TenantContextService) {}

  private async write(
    orgId: string,
    fn: (tx: TenantPrismaClient) => Promise<string>,
  ): Promise<BridalGroupPayload> {
    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const groupId = await fn(tx);
        return { group: await viewOf(tx, groupId), errors: [] };
      });
    } catch (e) {
      return fail(e);
    }
  }

  create(
    orgId: string,
    memberId: string,
    input: CreateBridalGroupInput,
  ): Promise<BridalGroupPayload> {
    return this.write(orgId, (tx) =>
      createBridalGroupTx(tx, orgId, memberId, input),
    );
  }

  update(
    orgId: string,
    memberId: string,
    id: string,
    input: BridalGroupFieldsInput,
  ): Promise<BridalGroupPayload> {
    // Se eventDate mudar com contrato vivo, só o grupo é atualizado; o 04-06 recalcula o prazo do saldo.
    return this.write(orgId, async (tx) => {
      await requireActiveGroup(tx, id);
      const current = await tx.bridalGroup.findFirstOrThrow({
        where: { id },
        select: { eventKind: true },
      });
      const fields = await validateGroupFields(
        tx,
        orgId,
        input,
        current.eventKind,
      );
      const bride = await tx.bridalGroupMember.findFirst({
        where: { groupId: id, role: "bride" },
        select: { clientId: true },
      });
      const responsibleId = await resolveResponsibleTx(
        tx,
        orgId,
        input,
        fields.eventKind,
        bride?.clientId ?? null,
      );
      const before = await tx.bridalGroup.findFirstOrThrow({
        where: { id },
        select: {
          locationKind: true,
          travelMinutesBefore: true,
          travelMinutesAfter: true,
          packageId: true,
        },
      });
      // packageId tratado à parte para preservar a semântica omitido (mantém) x null (limpa)
      let packageId = before.packageId;
      if (input.packageId === null) packageId = null;
      else if (input.packageId !== undefined) {
        packageId = await validatePackage(tx, orgId, input.packageId);
      }
      await tx.bridalGroup.update({
        where: { id },
        data: {
          ...fields,
          packageId,
          ...(responsibleId !== undefined
            ? { responsibleClientId: responsibleId }
            : {}),
        },
      });
      if (
        before.locationKind !== fields.locationKind ||
        before.travelMinutesBefore !== fields.travelMinutesBefore ||
        before.travelMinutesAfter !== fields.travelMinutesAfter
      ) {
        await rebuildTravelBlocksTx(tx, orgId, memberId, id);
      }
      if (packageId && packageId !== before.packageId) {
        await applyPackageToBrideTx(tx, orgId, id, packageId);
      }
      await syncContractCoverageTx(tx, orgId, id);
      return id;
    });
  }

  addMember(
    orgId: string,
    groupId: string,
    person: BridalPersonInput,
  ): Promise<BridalGroupPayload> {
    return this.write(orgId, async (tx) => {
      await requireActiveGroup(tx, groupId);
      const existing = await tx.bridalGroupMember.findMany({
        where: { groupId },
        select: { clientId: true, sortOrder: true },
      });
      if (existing.length + 1 > MAX_PEOPLE) {
        throw new BridalError(
          "TOO_MANY_PEOPLE",
          `Máximo de ${MAX_PEOPLE} pessoas por grupo.`,
          "groupId",
        );
      }
      const used = new Set(existing.map((m) => m.clientId));
      const next = existing.reduce((mx, m) => Math.max(mx, m.sortOrder), 0) + 1;
      await insertMemberTx(tx, orgId, groupId, "companion", next, person, used);
      return groupId;
    });
  }

  removeMember(orgId: string, memberId: string): Promise<BridalGroupPayload> {
    return this.write(orgId, async (tx) => {
      const m = await requireMember(tx, memberId);
      await requireActiveGroup(tx, m.groupId);
      if (m.role === "bride") {
        throw new BridalError(
          "CANNOT_REMOVE_BRIDE",
          "A noiva não pode ser removida do grupo.",
          "memberId",
        );
      }
      const appt = await tx.appointment.findFirst({
        where: {
          bridalGroupId: m.groupId,
          clientId: m.clientId,
          status: { in: BLOCKING_APPOINTMENT_STATUSES },
        },
        select: { id: true },
      });
      if (appt) {
        throw new BridalError(
          "MEMBER_HAS_APPOINTMENTS",
          "Esta pessoa já tem agendamentos no grupo. Cancele-os primeiro.",
          "memberId",
        );
      }
      if (await hasLiveContractItems(tx, memberId)) {
        throw new BridalError(
          "MEMBER_IN_CONTRACT",
          "Remova os itens desta pessoa do contrato primeiro.",
          "memberId",
        );
      }
      await tx.bridalGroupMember.delete({ where: { id: memberId } });
      return m.groupId;
    });
  }

  setCoverage(
    orgId: string,
    memberId: string,
    covered: boolean,
  ): Promise<BridalGroupPayload> {
    return this.write(orgId, async (tx) => {
      const m = await requireMember(tx, memberId);
      await requireActiveGroup(tx, m.groupId);
      if (m.coveredByContract !== covered) {
        // D-25: comanda do grupo já fechada trava a cobertura.
        if (await hasClosedComanda(tx, m.groupId, m.clientId)) {
          throw new BridalError(
            "COVERAGE_LOCKED",
            "A comanda desta pessoa já foi fechada; a cobertura não pode mudar.",
            "memberId",
          );
        }
        if (!covered && (await hasLiveContractItems(tx, memberId))) {
          throw new BridalError(
            "MEMBER_IN_CONTRACT",
            "Remova os itens desta pessoa do contrato primeiro.",
            "memberId",
          );
        }
        await tx.bridalGroupMember.update({
          where: { id: memberId },
          data: { coveredByContract: covered },
        });
        await syncContractCoverageTx(tx, orgId, m.groupId);
      }
      return m.groupId;
    });
  }

  setServices(
    orgId: string,
    memberId: string,
    services: BridalMemberServiceInput[],
  ): Promise<BridalGroupPayload> {
    return this.write(orgId, async (tx) => {
      const m = await requireMember(tx, memberId);
      await requireActiveGroup(tx, m.groupId);
      const valid = await validateServices(tx, services);
      await tx.bridalMemberService.deleteMany({
        where: { groupMemberId: memberId },
      });
      if (valid.length > 0) {
        await tx.bridalMemberService.createMany({
          data: valid.map((s, i) => ({
            organizationId: orgId,
            groupMemberId: memberId,
            serviceId: s.serviceId,
            purpose: s.purpose,
            sortOrder: i,
          })),
        });
      }
      return m.groupId;
    });
  }

  /** Agenda o evento: pessoa × serviço × profissional × horário viram agendamentos reais (D-03). */
  async schedule(
    orgId: string,
    memberId: string,
    input: BridalScheduleInput,
  ): Promise<BridalSchedulePayload> {
    try {
      return await this.tenant.runWithTenant(
        orgId,
        async (tx) => {
          const { appointmentIds } = await createBridalScheduleTx(
            tx,
            orgId,
            memberId,
            input,
          );
          await syncContractCoverageTx(tx, orgId, input.groupId);
          return {
            group: await viewOf(tx, input.groupId),
            appointmentIds,
            errors: [],
          };
        },
        BRIDAL_SCHEDULE_TX_OPTIONS,
      );
    } catch (e) {
      const m = mapBridalError(e);
      if (m) return { group: null, appointmentIds: [], errors: [m] };
      throw e;
    }
  }

  /** Cancela o grupo: exige contrato já cancelado; cancela agendamentos e remove deslocamentos. */
  async cancelGroup(
    orgId: string,
    memberId: string,
    input: { id: string; reason: string },
  ): Promise<BridalGroupPayload> {
    const reason = (input.reason ?? "").trim();
    if (reason.length < 3) {
      return {
        group: null,
        errors: [
          {
            code: "REASON_REQUIRED",
            message: "Informe o motivo do cancelamento.",
            field: "reason",
          },
        ],
      };
    }
    try {
      return await this.tenant.runWithTenant(
        orgId,
        async (tx) => {
          await requireActiveGroup(tx, input.id);
          const live = await tx.contract.findFirst({
            where: { bridalGroupId: input.id, status: { not: "cancelled" } },
            select: { id: true },
          });
          if (live) {
            throw new BridalError(
              "CANCEL_CONTRACT_FIRST",
              "Cancele o contrato antes de cancelar o grupo.",
              "id",
            );
          }
          const cancelled = await cancelGroupAppointmentsTx(
            tx,
            orgId,
            memberId,
            {
              groupId: input.id,
              reason,
            },
          );
          await tx.bridalGroup.update({
            where: { id: input.id },
            data: {
              status: "cancelled",
              cancelledAt: new Date(),
              cancelReason: reason,
            },
          });
          await recordAudit(tx, {
            orgId,
            actorMemberId: memberId,
            action: "bridal.cancel",
            entityType: "bridal_group",
            entityId: input.id,
            reason,
            metadata: { cancelledAppointments: cancelled },
          });
          return { group: await viewOf(tx, input.id), errors: [] };
        },
        BRIDAL_SCHEDULE_TX_OPTIONS,
      );
    } catch (e) {
      return fail(e);
    }
  }

  /**
   * Exclusão definitiva e irreversível do grupo e de tudo dele (contratos, parcelas,
   * pagamentos, caixa, agendamentos, comandas do grupo). Não exige contrato cancelado;
   * as clientes não são apagadas. A limpeza roda na função SECURITY DEFINER
   * purge_bridal_group (tabelas append-only).
   */
  async deletePermanently(
    orgId: string,
    memberId: string,
    id: string,
  ): Promise<{ deletedId: string | null; errors: BridalUserError[] }> {
    try {
      return await this.tenant.runWithTenant(
        orgId,
        async (tx) => {
          const g = await tx.bridalGroup.findFirst({
            where: { id },
            select: { id: true, name: true, eventDate: true },
          });
          if (!g) throw new BridalError("NOT_FOUND", "Grupo não encontrado.", "id");

          const [appointments, contracts] = await Promise.all([
            tx.appointment.findMany({
              where: { bridalGroupId: id },
              select: { id: true, comandaId: true },
            }),
            tx.contract.findMany({
              where: { bridalGroupId: id },
              select: { id: true },
            }),
          ]);
          const apptIds = appointments.map((a) => a.id);
          const contractIds = contracts.map((c) => c.id);
          const viaItems = await tx.comandaItem.findMany({
            where: {
              OR: [
                { appointmentId: { in: apptIds } },
                { contractId: { in: contractIds } },
              ],
            },
            select: { comandaId: true },
          });
          const comandaIds = [
            ...new Set([
              ...viaItems.map((i) => i.comandaId),
              ...appointments
                .map((a) => a.comandaId)
                .filter((c): c is string => c !== null),
            ]),
          ];
          const apptSet = new Set(apptIds);
          const contractSet = new Set(contractIds);
          // Item sem vínculo com o grupo (inclusive avulso, com os dois NULL) = comanda compartilhada.
          const comandaItems = await tx.comandaItem.findMany({
            where: { comandaId: { in: comandaIds } },
            select: { appointmentId: true, contractId: true },
          });
          const shared = comandaItems.some(
            (i) =>
              !(i.appointmentId && apptSet.has(i.appointmentId)) &&
              !(i.contractId && contractSet.has(i.contractId)),
          );
          if (shared) {
            throw new BridalError(
              "BRIDAL_SHARED_COMANDA",
              "Uma comanda deste grupo também tem itens de outros atendimentos. Separe ou feche essa comanda antes de excluir o grupo.",
              "id",
            );
          }

          await tx.$executeRaw`SELECT purge_bridal_group(${id}::uuid)`;
          await recordAudit(tx, {
            orgId,
            actorMemberId: memberId,
            action: "bridal.delete_permanent",
            entityType: "bridal_group",
            entityId: id,
            metadata: {
              name: g.name,
              eventDate: g.eventDate.toISOString().slice(0, 10),
              contracts: contractIds.length,
              appointments: apptIds.length,
            },
          });
          return { deletedId: id as string | null, errors: [] };
        },
        BRIDAL_SCHEDULE_TX_OPTIONS,
      );
    } catch (e) {
      const m = mapBridalError(e);
      if (m) return { deletedId: null, errors: [m] };
      throw e;
    }
  }

  async list(
    orgId: string,
    filters: {
      status?: string | null;
      from?: string | null;
      to?: string | null;
    },
  ): Promise<BridalGroupView[]> {
    for (const d of [filters.from, filters.to]) {
      if (d && !isValidDate(d)) {
        throw new BadRequestException("Data inválida; use YYYY-MM-DD.");
      }
    }
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const rows = await tx.bridalGroup.findMany({
        where: {
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.from || filters.to
            ? {
                eventDate: {
                  ...(filters.from
                    ? { gte: new Date(`${filters.from}T00:00:00.000Z`) }
                    : {}),
                  ...(filters.to
                    ? { lte: new Date(`${filters.to}T00:00:00.000Z`) }
                    : {}),
                },
              }
            : {}),
        },
        include: BRIDAL_GROUP_INCLUDE,
        orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
        take: LIST_LIMIT,
      });
      return buildViews(tx, rows);
    });
  }

  async get(orgId: string, id: string): Promise<BridalGroupView | null> {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const row = await loadGroupRow(tx, id);
      return row ? (await buildViews(tx, [row]))[0] : null;
    });
  }
}
