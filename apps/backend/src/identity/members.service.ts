import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { PasswordService } from '../auth/password.service';
import {
  TEMP_PASSWORD_MAX,
  TEMP_PASSWORD_MIN,
  generatePassword,
} from '../auth/temporary-password';
import {
  CreateMemberInput,
  MEMBER_STATUS_ACTIVE,
  MEMBER_STATUS_INACTIVE,
  UpdateMemberInput,
} from './dto/member.input';
import { normalizeBrPhone, normalizePixKey } from './member-contact';

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

const errPayload = (code: string, message: string, field?: string) => ({
  member: null,
  errors: [{ code, message, field: field ?? null }] as UserError[],
});

const createErr = (code: string, message: string, field?: string) => ({
  member: null,
  existingAccount: false,
  warning: null as string | null,
  errors: [{ code, message, field: field ?? null }] as UserError[],
});

const resetErr = (code: string, message: string) => ({
  member: null,
  temporaryPassword: null as string | null,
  errors: [{ code, message, field: null }] as UserError[],
});

const EXISTING_ACCOUNT_WARNING =
  'Essa pessoa já tem conta no SGS e entra com a senha que já usa.';

const MEMBER_SELECT = {
  id: true,
  displayName: true,
  seniorityTier: true,
  isProfessional: true,
  status: true,
  phone: true,
  pixKey: true,
  birthDate: true,
  createdAt: true,
  user: { select: { email: true } },
  role: { select: { name: true } },
  categories: {
    select: {
      category: { select: { id: true, name: true, deletedAt: true } },
    },
  },
} as const;

type MemberRow = {
  id: string;
  displayName: string;
  seniorityTier: string | null;
  isProfessional: boolean;
  status: string;
  phone: string | null;
  pixKey: string | null;
  birthDate: Date | null;
  createdAt: Date;
  user: { email: string };
  role: { name: string } | null;
  categories: {
    category: { id: string; name: string; deletedAt: Date | null };
  }[];
};

const PERSONAL_DATA_ROLES = ['ADMIN', 'MANAGER'];

/**
 * LGPD: telefone, Pix e nascimento só para ADMIN/MANAGER. Os demais papéis
 * enxergam o restante da equipe sem esses dados.
 */
export function redactPersonal<
  T extends {
    phone: string | null;
    pixKey: string | null;
    birthDate: Date | null;
  },
>(dto: T, callerRoleName: string): T {
  if (PERSONAL_DATA_ROLES.includes(callerRoleName)) return dto;
  return { ...dto, phone: null, pixKey: null, birthDate: null };
}

type BlockingAppointment = {
  id: string;
  startsAt: Date;
  clientName: string;
  serviceName: string;
};

const ADMIN_ROLE_NAME = 'ADMIN';
const PROFESSIONAL_ROLE_NAME = 'PROFESSIONAL';
const ALREADY_MEMBER_MESSAGE =
  'Essa pessoa já faz parte deste salão (pode estar inativa ou removida da equipe).';

/**
 * True when `member` is an active ADMIN and no OTHER active, non-deleted ADMIN
 * exists in the organization — i.e. demoting/deactivating it would leave the
 * salon without any administrator. Must run inside the tenant transaction (RLS).
 */
async function isLastActiveAdmin(
  tx: TenantPrismaClient,
  orgId: string,
  member: {
    id: string;
    status: string;
    deletedAt: Date | null;
    role: { name: string } | null;
  },
): Promise<boolean> {
  if (
    member.deletedAt !== null ||
    member.status !== MEMBER_STATUS_ACTIVE ||
    member.role?.name !== ADMIN_ROLE_NAME
  ) {
    return false;
  }
  const others = await tx.member.count({
    where: {
      organizationId: orgId,
      id: { not: member.id },
      status: MEMBER_STATUS_ACTIVE,
      deletedAt: null,
      role: { name: ADMIN_ROLE_NAME },
    },
  });
  return others === 0;
}

function toMemberDto(r: MemberRow) {
  return {
    id: r.id,
    displayName: r.displayName,
    email: r.user.email,
    roleName: r.role?.name ?? 'UNKNOWN',
    seniorityTier: r.seniorityTier ?? null,
    isProfessional: r.isProfessional,
    status: r.status,
    phone: r.phone ?? null,
    pixKey: r.pixKey ?? null,
    birthDate: r.birthDate ?? null,
    createdAt: r.createdAt,
    categories: r.categories
      .filter((c) => c.category.deletedAt === null)
      .map((c) => ({ id: c.category.id, name: c.category.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  };
}

const MIN_NAME_LENGTH = 2;

/** Valida que todas as categorias existem (não deletadas) na organização. */
async function categoriesExist(
  tx: TenantPrismaClient,
  categoryIds: string[],
): Promise<boolean> {
  if (categoryIds.length === 0) return true;
  const found = await tx.category.count({
    where: { id: { in: categoryIds }, deletedAt: null },
  });
  return found === categoryIds.length;
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
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
  ) {}

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
        include: { role: { select: { name: true } } },
      });
      if (!existing) {
        return errPayload('MEMBER_NOT_FOUND', 'Membro não encontrado.');
      }

      const data: {
        roleId?: string;
        isProfessional?: boolean;
        seniorityTier?: string | null;
        phone?: string;
        pixKey?: string;
        birthDate?: Date | null;
      } = {};

      if (input.phone !== undefined) {
        const phone =
          input.phone === null ? null : normalizeBrPhone(input.phone);
        if (!phone) {
          return errPayload('INVALID_PHONE', 'Telefone inválido.', 'phone');
        }
        data.phone = phone;
      }

      if (input.pixKey !== undefined) {
        const pix =
          input.pixKey === null ? null : normalizePixKey(input.pixKey);
        if (!pix) {
          return errPayload('INVALID_PIX_KEY', 'Chave Pix inválida.', 'pixKey');
        }
        data.pixKey = pix.value;
      }

      if (input.birthDate !== undefined) {
        data.birthDate = input.birthDate;
      }

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
        if (
          input.roleName !== ADMIN_ROLE_NAME &&
          (await isLastActiveAdmin(tx, orgId, existing))
        ) {
          return errPayload(
            'LAST_ADMIN',
            'Não é possível remover o papel de administrador do último administrador ativo do salão. Promova outro membro a administrador antes.',
            'roleName',
          );
        }
        data.roleId = role.id;
      }

      const finalRoleName = input.roleName ?? existing.role?.name;
      const finalIsProfessional =
        finalRoleName === PROFESSIONAL_ROLE_NAME
          ? true
          : (input.isProfessional ?? existing.isProfessional);
      if (
        input.roleName !== undefined ||
        input.isProfessional !== undefined ||
        finalIsProfessional !== existing.isProfessional
      ) {
        data.isProfessional = finalIsProfessional;
      }

      if (input.seniorityTier !== undefined) {
        data.seniorityTier = input.seniorityTier;
      }

      let categoryIds: string[] | undefined;
      if (finalIsProfessional && input.categoryIds !== undefined) {
        categoryIds = [...new Set(input.categoryIds)];
        if (!(await categoriesExist(tx, categoryIds))) {
          return errPayload(
            'CATEGORY_NOT_FOUND',
            'Categoria não encontrada.',
            'categoryIds',
          );
        }
      }

      if (!finalIsProfessional) {
        await tx.memberCategory.deleteMany({ where: { memberId: input.id } });
      } else if (categoryIds !== undefined) {
        await tx.memberCategory.deleteMany({ where: { memberId: input.id } });
        if (categoryIds.length > 0) {
          await tx.memberCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              organizationId: orgId,
              memberId: input.id,
              categoryId,
            })),
          });
        }
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
   * Cadastro direto de membro com senha provisória (sem e-mail). Se o e-mail
   * já tem conta, cria só o member nesta organização e NÃO toca na senha.
   */
  async create(
    orgId: string,
    callerRoleName: string,
    input: CreateMemberInput,
  ) {
    const displayName = input.displayName.trim();
    if (displayName.length < MIN_NAME_LENGTH) {
      return createErr('INVALID_NAME', 'Informe o nome.', 'displayName');
    }
    const email = input.email.trim().toLowerCase();
    const phone = normalizeBrPhone(input.phone);
    if (!phone) {
      return createErr('INVALID_PHONE', 'Telefone inválido.', 'phone');
    }
    const pix = normalizePixKey(input.pixKey);
    if (!pix) {
      return createErr('INVALID_PIX_KEY', 'Chave Pix inválida.', 'pixKey');
    }
    if (callerRoleName === 'MANAGER' && input.roleName === ADMIN_ROLE_NAME) {
      return createErr(
        'FORBIDDEN_ROLE',
        'Gerentes não podem cadastrar administradores.',
        'roleName',
      );
    }

    const isProfessional =
      input.roleName === PROFESSIONAL_ROLE_NAME ? true : !!input.isProfessional;
    const categoryIds = isProfessional
      ? [...new Set(input.categoryIds ?? [])]
      : [];
    if (isProfessional && categoryIds.length === 0) {
      return createErr(
        'CATEGORY_REQUIRED',
        'Escolha ao menos uma categoria que o profissional atende.',
        'categoryIds',
      );
    }

    // Users não têm RLS. A senha só é exigida (e o hash, lento, só é feito)
    // quando o usuário é novo — e sempre fora da transação.
    const preexisting = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    let passwordHash: string | null = null;
    if (!preexisting) {
      const pwd = input.temporaryPassword;
      if (pwd.length < TEMP_PASSWORD_MIN || pwd.length > TEMP_PASSWORD_MAX) {
        return createErr(
          'WEAK_PASSWORD',
          `A senha provisória deve ter entre ${TEMP_PASSWORD_MIN} e ${TEMP_PASSWORD_MAX} caracteres.`,
          'temporaryPassword',
        );
      }
      passwordHash = await this.password.hash(pwd);
    }

    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const role = await tx.role.findFirst({
          where: { name: input.roleName, isSystem: true },
        });
        if (!role) {
          return createErr('ROLE_NOT_FOUND', 'Papel inválido.', 'roleName');
        }
        if (!(await categoriesExist(tx, categoryIds))) {
          return createErr(
            'CATEGORY_NOT_FOUND',
            'Categoria não encontrada.',
            'categoryIds',
          );
        }

        const existingUser = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });

        let userId: string;
        if (existingUser) {
          const already = await tx.member.findFirst({
            where: { organizationId: orgId, userId: existingUser.id },
            select: { id: true },
          });
          if (already) {
            return createErr(
              'MEMBER_ALREADY_EXISTS',
              ALREADY_MEMBER_MESSAGE,
              'email',
            );
          }
          userId = existingUser.id;
        } else {
          if (!passwordHash) {
            throw new Error('create member: missing password hash for new user');
          }
          const user = await tx.user.create({
            data: {
              email,
              passwordHash,
              fullName: displayName,
              // Cadastro feito pelo admin: não há e-mail a confirmar.
              emailVerifiedAt: new Date(),
              mustChangePassword: true,
            },
          });
          userId = user.id;
        }

        const created = await tx.member.create({
          data: {
            organizationId: orgId,
            userId,
            roleId: role.id,
            displayName,
            isProfessional,
            status: MEMBER_STATUS_ACTIVE,
            phone,
            pixKey: pix.value,
            birthDate: input.birthDate ?? null,
          },
          select: { id: true },
        });
        if (categoryIds.length > 0) {
          await tx.memberCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              organizationId: orgId,
              memberId: created.id,
              categoryId,
            })),
          });
        }
        const row = await tx.member.findUniqueOrThrow({
          where: { id: created.id },
          select: MEMBER_SELECT,
        });

        return {
          member: toMemberDto(row),
          existingAccount: !!existingUser,
          warning: existingUser ? EXISTING_ACCOUNT_WARNING : null,
          errors: [] as UserError[],
        };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return createErr('MEMBER_ALREADY_EXISTS', ALREADY_MEMBER_MESSAGE, 'email');
      }
      throw e;
    }
  }

  /**
   * Gera nova senha provisória para um membro que pertence só a esta
   * organização. Revoga refresh tokens e força troca no próximo acesso.
   */
  async resetPassword(orgId: string, callerMemberId: string, id: string) {
    const temporaryPassword = generatePassword();
    const hash = await this.password.hash(temporaryPassword);

    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          user: { select: { isPlatformAdmin: true } },
        },
      });
      if (!existing) {
        return resetErr('MEMBER_NOT_FOUND', 'Membro não encontrado.');
      }
      if (existing.id === callerMemberId) {
        return resetErr(
          'CANNOT_RESET_SELF',
          'Você não pode gerar uma senha provisória para si mesmo. Use "Trocar senha".',
        );
      }
      const inOtherOrg = () =>
        resetErr(
          'MEMBER_IN_OTHER_ORGANIZATION',
          'Essa pessoa também trabalha em outro salão; a senha dela não pode ser redefinida por aqui.',
        );
      if (existing.user.isPlatformAdmin) return inOtherOrg();

      const rows = await tx.$queryRaw<{ count: number }[]>`
        SELECT member_user_org_count(${existing.userId}::uuid) AS count`;
      if (Number(rows[0]?.count ?? 0) > 1) return inOtherOrg();

      await tx.user.update({
        where: { id: existing.userId },
        data: { passwordHash: hash, mustChangePassword: true },
      });
      await tx.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Senha provisória gerada para o member ${id} (org ${orgId}) por ${callerMemberId}`,
      );

      const row = await tx.member.findUniqueOrThrow({
        where: { id },
        select: MEMBER_SELECT,
      });
      return {
        member: toMemberDto(row),
        temporaryPassword: temporaryPassword as string | null,
        errors: [] as UserError[],
      };
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
        include: { role: { select: { name: true } } },
      });
      if (!existing) {
        return {
          ...errPayload('MEMBER_NOT_FOUND', 'Membro não encontrado.'),
          futureAppointmentCount: 0,
          blockingAppointments: [] as BlockingAppointment[],
          activeCommissionRuleCount: 0,
        };
      }

      if (await isLastActiveAdmin(tx, orgId, existing)) {
        const ruleCount = await tx.commissionRule.count({
          where: { memberId: id, deletedAt: null },
        });
        return {
          member: null,
          futureAppointmentCount: 0,
          blockingAppointments: [] as BlockingAppointment[],
          activeCommissionRuleCount: ruleCount,
          errors: [
            {
              code: 'LAST_ADMIN',
              message:
                'Não é possível desativar o último administrador ativo do salão. Promova outro membro a administrador antes.',
              field: null,
            },
          ] as UserError[],
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
        blockingAppointments: [] as BlockingAppointment[],
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
