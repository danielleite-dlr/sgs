import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import {
  MEMBER_STATUS_ACTIVE,
  MEMBER_STATUS_INACTIVE,
  UpdateMemberInput,
} from './dto/member.input';

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

const errPayload = (code: string, message: string, field?: string) => ({
  member: null,
  errors: [{ code, message, field: field ?? null }] as UserError[],
});

const MEMBER_SELECT = {
  id: true,
  displayName: true,
  seniorityTier: true,
  isProfessional: true,
  status: true,
  createdAt: true,
  user: { select: { email: true } },
  role: { select: { name: true } },
} as const;

type MemberRow = {
  id: string;
  displayName: string;
  seniorityTier: string | null;
  isProfessional: boolean;
  status: string;
  createdAt: Date;
  user: { email: string };
  role: { name: string } | null;
};

function toMemberDto(r: MemberRow) {
  return {
    id: r.id,
    displayName: r.displayName,
    email: r.user.email,
    roleName: r.role?.name ?? 'UNKNOWN',
    seniorityTier: r.seniorityTier ?? null,
    isProfessional: r.isProfessional,
    status: r.status,
    createdAt: r.createdAt,
  };
}

/**
 * MembersService — the full member lifecycle for a tenant.
 * `listActive` feeds the schedule/commission-rule pickers (only active members);
 * `listAll` feeds the admin team screen (active + inactive, with status).
 * `update`/`deactivate`/`reactivate` never write `deletedAt` — that column is
 * reserved for a future hard-delete flow. Deactivation is guarded by future
 * appointments; an active commission rule is reported but never blocks.
 */
@Injectable()
export class MembersService {
  constructor(private readonly tenant: TenantContextService) {}

  /**
   * Returns active, non-deleted members of the given organization,
   * ordered alphabetically by displayName. Used by the schedule and
   * commission-rule pickers — inactive members must never appear here.
   */
  async listActive(orgId: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.member
        .findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            status: MEMBER_STATUS_ACTIVE,
          },
          select: MEMBER_SELECT,
          orderBy: { displayName: 'asc' },
        })
        .then((rows) => rows.map(toMemberDto)),
    );
  }

  /**
   * Returns every non-deleted member of the organization, active or
   * inactive, with their status — used by the admin team screen.
   */
  async listAll(orgId: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.member
        .findMany({
          where: { organizationId: orgId, deletedAt: null },
          select: MEMBER_SELECT,
          orderBy: { displayName: 'asc' },
        })
        .then((rows) => rows.map(toMemberDto)),
    );
  }

  /**
   * Updates roleName, isProfessional and/or seniorityTier of an existing
   * member. Fields absent from the input are left untouched;
   * `seniorityTier: null` is an explicit clear. Implements EQUIPE-02
   * (updateMember → member.editRole).
   */
  async update(orgId: string, input: UpdateMemberInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
      });
      if (!existing) {
        return errPayload('MEMBER_NOT_FOUND', 'Membro não encontrado.');
      }

      const data: {
        roleId?: string;
        isProfessional?: boolean;
        seniorityTier?: string | null;
      } = {};

      if (input.roleName !== undefined) {
        const role = await tx.role.findFirst({
          where: { name: input.roleName, isSystem: true },
        });
        if (!role) {
          return errPayload(
            'ROLE_NOT_FOUND',
            'Papel inválido.',
            'roleName',
          );
        }
        data.roleId = role.id;
      }

      if (input.isProfessional !== undefined) {
        data.isProfessional = input.isProfessional;
      }

      if (input.seniorityTier !== undefined) {
        data.seniorityTier = input.seniorityTier;
      }

      const row = await tx.member.update({
        where: { id: input.id },
        data,
        select: MEMBER_SELECT,
      });

      return { member: toMemberDto(row), errors: [] as UserError[] };
    });
  }

  /**
   * Deactivates a member (status='inactive') unless there is at least one
   * future, non-cancelled appointment assigned to them — in which case the
   * deactivation is refused and the payload carries the count + the next
   * few blocking appointments so the admin can reassign them. An active
   * commission rule linked to the member is reported (activeCommissionRuleCount)
   * but never blocks: it doesn't leave a client unattended, it stays
   * readable via CommissionsService.list(), and it can't be recreated for
   * an inactive member (commissions.service.ts requires status: 'active').
   * `deletedAt` is never written here — reserved for a future hard-delete.
   */
  async deactivate(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx: TenantPrismaClient) => {
      const existing = await tx.member.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
      });
      if (!existing) {
        return {
          ...errPayload('MEMBER_NOT_FOUND', 'Membro não encontrado.'),
          futureAppointmentCount: 0,
          blockingAppointments: [] as {
            id: string;
            startsAt: Date;
            clientName: string;
            serviceName: string;
          }[],
          activeCommissionRuleCount: 0,
        };
      }

      const now = new Date();
      const futureWhere = {
        professionalId: id,
        startsAt: { gt: now },
        status: { notIn: ['cancelled', 'no_show'] },
      };

      const [futureAppointmentCount, blocking, activeCommissionRuleCount] =
        await Promise.all([
          tx.appointment.count({ where: futureWhere }),
          tx.appointment.findMany({
            where: futureWhere,
            orderBy: { startsAt: 'asc' },
            take: 5,
            select: {
              id: true,
              startsAt: true,
              client: { select: { fullName: true } },
              service: { select: { name: true } },
            },
          }),
          tx.commissionRule.count({
            where: { memberId: id, deletedAt: null },
          }),
        ]);

      const blockingAppointments = blocking.map((a) => ({
        id: a.id,
        startsAt: a.startsAt,
        clientName: a.client.fullName,
        serviceName: a.service.name,
      }));

      if (futureAppointmentCount > 0) {
        const first = blockingAppointments[0];
        const firstDate = first
          ? first.startsAt.toLocaleDateString('pt-BR')
          : '';
        return {
          member: null,
          futureAppointmentCount,
          blockingAppointments,
          activeCommissionRuleCount,
          errors: [
            {
              code: 'MEMBER_HAS_FUTURE_APPOINTMENTS',
              message: `${existing.displayName} tem ${futureAppointmentCount} agendamento(s) futuro(s) — o primeiro em ${firstDate}. Remaneje-os antes de desativar.`,
              field: null,
            },
          ] as UserError[],
        };
      }

      const row = await tx.member.update({
        where: { id },
        data: { status: MEMBER_STATUS_INACTIVE },
        select: MEMBER_SELECT,
      });

      return {
        member: toMemberDto(row),
        futureAppointmentCount: 0,
        blockingAppointments: [] as {
          id: string;
          startsAt: Date;
          clientName: string;
          serviceName: string;
        }[],
        activeCommissionRuleCount,
        errors: [] as UserError[],
      };
    });
  }

  /**
   * Reactivates a member (status='active'). No guard — decision locked in
   * CONTEXT. Idempotent on an already-active member.
   */
  async reactivate(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
      });
      if (!existing) {
        return errPayload('MEMBER_NOT_FOUND', 'Membro não encontrado.');
      }

      const row = await tx.member.update({
        where: { id },
        data: { status: MEMBER_STATUS_ACTIVE },
        select: MEMBER_SELECT,
      });

      return { member: toMemberDto(row), errors: [] as UserError[] };
    });
  }
}
