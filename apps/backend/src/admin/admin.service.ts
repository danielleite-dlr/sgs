import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService, isUuid } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import type { AuthPayloadDto, UserError } from '../auth/dto/auth.payload';

export interface AdminClientDto {
  organizationId: string;
  tradeName: string;
  legalName: string;
  email: string;
  phone: string | null;
  subdomain: string;
  segment: string;
  status: string;
  createdAt: Date;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLastLoginAt: Date | null;
  ownerMustChangePassword: boolean;
  memberCount: number;
}

export interface AdminClientResult {
  client: AdminClientDto | null;
  /** Senha gerada. Só volta na criação e no reset, e nunca é recuperável depois. */
  temporaryPassword: string | null;
  errors: UserError[];
}

export interface PlatformUserDto {
  userId: string;
  fullName: string;
  email: string;
  isPlatformMaster: boolean;
  canAccessClientOrgs: boolean;
  lastLoginAt: Date | null;
}

/** Sem I, l, O, 0 e 1: a senha é ditada por WhatsApp, ambiguidade custa suporte. */
const PASSWORD_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generatePassword(length = 14): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

/**
 * AdminService — operações do painel de plataforma.
 *
 * Cadastro, edição, suspensão, reset de senha e entrada no salão do cliente.
 *
 * Sobre RLS: organizations e members são tenant-scoped sob FORCE RLS e o
 * platform admin não tem tenant. Leitura que cruza clientes sai pelas funções
 * SECURITY DEFINER; escrita em um cliente específico usa runWithTenant com o id
 * da organização alvo, que é exatamente o que a policy espera.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async listClients(adminUserId: string): Promise<AdminClientDto[]> {
    if (!isUuid(adminUserId)) {
      throw new Error(`listClients: invalid adminUserId "${adminUserId}"`);
    }
    const rows = await this.prisma.$queryRaw<
      {
        organization_id: string;
        trade_name: string;
        legal_name: string;
        email: string;
        phone: string | null;
        subdomain: string;
        segment: string;
        status: string;
        created_at: Date;
        owner_user_id: string | null;
        owner_name: string | null;
        owner_email: string | null;
        owner_last_login: Date | null;
        owner_must_change_pwd: boolean | null;
        member_count: bigint;
      }[]
    >`SELECT * FROM admin_list_clients(${adminUserId}::uuid)`;

    return rows.map((r) => ({
      organizationId: r.organization_id,
      tradeName: r.trade_name,
      legalName: r.legal_name,
      email: r.email,
      phone: r.phone,
      subdomain: r.subdomain,
      segment: r.segment,
      status: r.status,
      createdAt: r.created_at,
      ownerUserId: r.owner_user_id,
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      ownerLastLoginAt: r.owner_last_login,
      ownerMustChangePassword: r.owner_must_change_pwd ?? false,
      memberCount: Number(r.member_count),
    }));
  }

  /**
   * Cria um cliente: organização + usuário dono + membership ADMIN, numa única
   * transação. A senha é gerada aqui e devolvida uma única vez; o dono é
   * obrigado a trocá-la no primeiro acesso.
   */
  async createClient(
    adminUserId: string,
    input: {
      salonName: string;
      ownerName: string;
      ownerEmail: string;
      segment?: string;
    },
  ): Promise<AdminClientResult> {
    const emailLower = input.ownerEmail.trim().toLowerCase();

    const invalid =
      this.requireMinLength(input.salonName, 2, 'salonName', 'O nome do salão') ??
      this.requireMinLength(
        input.ownerName,
        2,
        'ownerName',
        'O nome do responsável',
      );
    if (invalid) return { client: null, temporaryPassword: null, errors: [invalid] };

    const existing = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing) {
      return {
        client: null,
        temporaryPassword: null,
        errors: [
          {
            code: 'EMAIL_TAKEN',
            message: 'E-mail já cadastrado.',
            field: 'ownerEmail',
          },
        ],
      };
    }

    const temporaryPassword = generatePassword();
    const hash = await this.password.hash(temporaryPassword);
    const adminRole = await this.prisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash: hash,
          fullName: input.ownerName.trim(),
          // Cadastro feito pelo admin: não há e-mail a confirmar.
          emailVerifiedAt: new Date(),
          // Senha temporária: troca obrigatória no primeiro acesso.
          mustChangePassword: true,
        },
      });

      const baseSlug = input.salonName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      const subdomain = `${baseSlug || 'salao'}-${Date.now().toString(36)}`;

      // A linha da organização ainda não existe, então deixar o banco gerar o id
      // faria o WITH CHECK da policy falhar (42501): reserva o id, seta o
      // contexto e só então insere. SET LOCAL é escopo de transação — nunca SET
      // puro, que vazaria entre conexões do PgBouncer.
      const [reserved] = await tx.$queryRaw<{ id: string }[]>`
        SELECT gen_uuid_v7()::text AS id
      `;
      const organizationId = reserved?.id ?? '';
      if (!isUuid(organizationId)) {
        throw new Error(
          `createClient: gen_uuid_v7() returned an invalid uuid "${organizationId}"`,
        );
      }
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_organization = '${organizationId}'`,
      );

      const org = await tx.organization.create({
        data: {
          id: organizationId,
          legalName: input.salonName.trim(),
          tradeName: input.salonName.trim(),
          documentType: 'CNPJ', // placeholder — preenchido no onboarding (D-10)
          documentNumber: Date.now().toString().slice(-14), // placeholder único
          email: emailLower,
          subdomain,
          segment: input.segment ?? 'salon',
        },
      });

      await tx.member.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          roleId: adminRole.id,
          displayName: input.ownerName.trim(),
          isProfessional: false,
          status: 'active',
        },
      });

      return { org, user };
    });

    this.logger.log(
      `admin=${adminUserId} criou cliente org=${created.org.id} owner=${created.user.id}`,
    );

    return {
      client: {
        organizationId: created.org.id,
        tradeName: created.org.tradeName,
        legalName: created.org.legalName,
        email: created.org.email,
        phone: created.org.phone,
        subdomain: created.org.subdomain,
        segment: created.org.segment,
        status: created.org.status,
        createdAt: created.org.createdAt,
        ownerUserId: created.user.id,
        ownerName: created.user.fullName,
        ownerEmail: created.user.email,
        ownerLastLoginAt: null,
        ownerMustChangePassword: true,
        memberCount: 1,
      },
      temporaryPassword,
      errors: [],
    };
  }

  /** Edita os dados cadastrais do cliente e, se vier, o nome do responsável. */
  async updateClient(
    adminUserId: string,
    input: {
      organizationId: string;
      tradeName?: string;
      legalName?: string;
      email?: string;
      phone?: string | null;
      segment?: string;
      ownerName?: string;
    },
  ): Promise<AdminClientResult> {
    if (!isUuid(input.organizationId)) {
      return this.notFound();
    }
    if (input.tradeName !== undefined) {
      const bad = this.requireMinLength(
        input.tradeName,
        2,
        'tradeName',
        'O nome do salão',
      );
      if (bad) return { client: null, temporaryPassword: null, errors: [bad] };
    }

    await this.tenant.runWithTenant(input.organizationId, async (tx) => {
      await tx.organization.update({
        where: { id: input.organizationId },
        data: {
          ...(input.tradeName !== undefined
            ? { tradeName: input.tradeName.trim() }
            : {}),
          ...(input.legalName !== undefined
            ? { legalName: input.legalName.trim() }
            : {}),
          ...(input.email !== undefined
            ? { email: input.email.trim().toLowerCase() }
            : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.segment !== undefined ? { segment: input.segment } : {}),
        },
      });

      if (input.ownerName !== undefined) {
        const owner = await this.findOwnerMember(tx, input.organizationId);
        if (owner) {
          await tx.member.update({
            where: { id: owner.id },
            data: { displayName: input.ownerName.trim() },
          });
          await tx.user.update({
            where: { id: owner.userId },
            data: { fullName: input.ownerName.trim() },
          });
        }
      }
    });

    this.logger.log(
      `admin=${adminUserId} editou cliente org=${input.organizationId}`,
    );
    return this.singleClient(adminUserId, input.organizationId);
  }

  /**
   * Suspende ou reativa um cliente. Suspenso, o salão inteiro perde o acesso: o
   * login recusa e o interceptor de tenant barra tokens já emitidos.
   */
  async setClientStatus(
    adminUserId: string,
    organizationId: string,
    status: 'active' | 'suspended',
  ): Promise<AdminClientResult> {
    if (!isUuid(organizationId)) return this.notFound();

    const memberUserIds = await this.tenant.runWithTenant(
      organizationId,
      async (tx) => {
        await tx.organization.update({
          where: { id: organizationId },
          data: { status },
        });
        const members = await tx.member.findMany({
          where: { organizationId, deletedAt: null },
          select: { userId: true },
        });
        return members.map((m) => m.userId);
      },
    );

    // Suspender só vale se cortar de verdade. O status do tenant viaja dentro
    // do access token, então um token emitido antes da suspensão continuaria
    // passando até expirar. Revogar os refresh tokens fecha a renovação: o
    // acesso morre quando o access token atual vencer, em no máximo 15 minutos.
    if (status === 'suspended' && memberUserIds.length > 0) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: { in: memberUserIds }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    this.logger.warn(
      `admin=${adminUserId} mudou status do cliente org=${organizationId} para ${status}`,
    );
    return this.singleClient(adminUserId, organizationId);
  }

  /**
   * Gera uma nova senha temporária para o dono do salão e obriga a troca no
   * próximo acesso. As sessões abertas dele são revogadas: senha resetada com
   * refresh token vivo não resolveria um acesso comprometido.
   */
  async resetClientPassword(
    adminUserId: string,
    organizationId: string,
  ): Promise<AdminClientResult> {
    if (!isUuid(organizationId)) return this.notFound();

    const owner = await this.tenant.runWithTenant(organizationId, (tx) =>
      this.findOwnerMember(tx, organizationId),
    );
    if (!owner) {
      return {
        client: null,
        temporaryPassword: null,
        errors: [
          {
            code: 'NOT_FOUND',
            message: 'Este cliente não tem um responsável cadastrado.',
          },
        ],
      };
    }

    const temporaryPassword = generatePassword();
    await this.prisma.user.update({
      where: { id: owner.userId },
      data: {
        passwordHash: await this.password.hash(temporaryPassword),
        mustChangePassword: true,
      },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: owner.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.warn(
      `admin=${adminUserId} resetou a senha do dono do cliente org=${organizationId}`,
    );
    const result = await this.singleClient(adminUserId, organizationId);
    return { ...result, temporaryPassword };
  }

  /**
   * Abre uma sessão dentro do salão do cliente.
   *
   * O admin não tem membership lá, então o token sai com uma membership
   * sintética apontando para a organização alvo e a role ADMIN. É o que o
   * interceptor de tenant e o PermissionGuard já sabem ler — o guard resolve
   * permissão pelo nome da role, não pelo member.
   *
   * Limite conhecido: o memberId usado é o do dono do salão, então escrita
   * feita aqui dentro fica atribuída a ele. A claim impersonating marca a
   * sessão e a entrada fica registrada no log.
   */
  async switchToClient(
    admin: { userId: string; email: string },
    organizationId: string,
  ): Promise<AuthPayloadDto> {
    if (!isUuid(organizationId)) {
      return {
        accessToken: null,
        refreshToken: null,
        session: null,
        errors: [{ code: 'NOT_FOUND', message: 'Cliente não encontrado.' }],
      };
    }

    const target = await this.tenant.runWithTenant(
      organizationId,
      async (tx) => {
        const org = await tx.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, tradeName: true, status: true },
        });
        const owner = await this.findOwnerMember(tx, organizationId);
        return { org, owner };
      },
    );

    if (!target.org || !target.owner) {
      return {
        accessToken: null,
        refreshToken: null,
        session: null,
        errors: [{ code: 'NOT_FOUND', message: 'Cliente não encontrado.' }],
      };
    }

    const adminUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: admin.userId },
      select: { fullName: true },
    });

    const membership = {
      memberId: target.owner.id,
      organizationId: target.org.id,
      roleName: 'ADMIN',
      organizationStatus: target.org.status,
    };

    const accessToken = await this.tokens.issueAccessToken({
      sub: admin.userId,
      email: admin.email,
      isPlatformAdmin: true,
      impersonating: true,
      impersonatorUserId: admin.userId,
      memberships: [membership],
    });

    this.logger.warn(
      `admin=${admin.userId} entrou no salão org=${organizationId} (${target.org.tradeName})`,
    );

    return {
      accessToken,
      // Sem refresh: a sessão dentro do cliente dura os 15 minutos do access
      // token e acaba. Para continuar, o admin entra de novo pelo painel.
      refreshToken: null,
      session: {
        userId: admin.userId,
        email: admin.email,
        fullName: adminUser.fullName,
        isPlatformAdmin: true,
        isPlatformMaster: false,
        canAccessClientOrgs: true,
        mustChangePassword: false,
        impersonating: true,
        memberships: [
          {
            ...membership,
            organizationName: target.org.tradeName,
          },
        ],
      },
      errors: [],
    };
  }

  /** Usuários com acesso de plataforma. Exclusivo do master. */
  async listPlatformUsers(masterUserId: string): Promise<PlatformUserDto[]> {
    if (!isUuid(masterUserId)) {
      throw new Error(`listPlatformUsers: invalid masterUserId "${masterUserId}"`);
    }
    const rows = await this.prisma.$queryRaw<
      {
        user_id: string;
        full_name: string;
        email: string;
        is_platform_master: boolean;
        can_access_client_orgs: boolean;
        last_login_at: Date | null;
      }[]
    >`SELECT * FROM admin_list_platform_users(${masterUserId}::uuid)`;

    return rows.map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      email: r.email,
      isPlatformMaster: r.is_platform_master,
      canAccessClientOrgs: r.can_access_client_orgs,
      lastLoginAt: r.last_login_at,
    }));
  }

  /**
   * Concede ou revoga acesso de plataforma. Só o master chama.
   *
   * O master não pode rebaixar a si mesmo: seria possível ficar sem nenhum
   * master e sem como voltar pela interface.
   */
  async setPlatformAccess(
    masterUserId: string,
    input: {
      userId: string;
      isPlatformAdmin: boolean;
      canAccessClientOrgs: boolean;
    },
  ): Promise<{ users: PlatformUserDto[]; errors: UserError[] }> {
    if (!isUuid(input.userId)) {
      return {
        users: [],
        errors: [{ code: 'NOT_FOUND', message: 'Usuário não encontrado.' }],
      };
    }
    if (input.userId === masterUserId) {
      return {
        users: await this.listPlatformUsers(masterUserId),
        errors: [
          {
            code: 'FORBIDDEN',
            message: 'Você não pode alterar o próprio acesso.',
          },
        ],
      };
    }

    const target = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, isPlatformMaster: true },
    });
    if (!target) {
      return {
        users: await this.listPlatformUsers(masterUserId),
        errors: [{ code: 'NOT_FOUND', message: 'Usuário não encontrado.' }],
      };
    }
    if (target.isPlatformMaster) {
      return {
        users: await this.listPlatformUsers(masterUserId),
        errors: [
          {
            code: 'FORBIDDEN',
            message: 'Não é possível alterar o acesso de outro master.',
          },
        ],
      };
    }

    await this.prisma.user.update({
      where: { id: input.userId },
      data: {
        isPlatformAdmin: input.isPlatformAdmin,
        // Sem acesso ao painel, entrar em salão não faz sentido.
        canAccessClientOrgs:
          input.isPlatformAdmin && input.canAccessClientOrgs,
      },
    });
    // Tokens antigos carregam as permissões velhas por até 15 minutos; revogar
    // o refresh encurta a janela de uma revogação de acesso.
    await this.prisma.refreshToken.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.warn(
      `master=${masterUserId} alterou acesso de plataforma do user=${input.userId}: admin=${input.isPlatformAdmin} salao=${input.canAccessClientOrgs}`,
    );

    return { users: await this.listPlatformUsers(masterUserId), errors: [] };
  }

  // ─── internos ──────────────────────────────────────────────────────────────

  private async findOwnerMember(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<{ id: string; userId: string } | null> {
    return tx.member.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        role: { name: 'ADMIN' },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true },
    });
  }

  private async singleClient(
    adminUserId: string,
    organizationId: string,
  ): Promise<AdminClientResult> {
    const all = await this.listClients(adminUserId);
    const client = all.find((c) => c.organizationId === organizationId) ?? null;
    return client
      ? { client, temporaryPassword: null, errors: [] }
      : this.notFound();
  }

  private notFound(): AdminClientResult {
    return {
      client: null,
      temporaryPassword: null,
      errors: [{ code: 'NOT_FOUND', message: 'Cliente não encontrado.' }],
    };
  }

  private requireMinLength(
    value: string,
    min: number,
    field: string,
    label: string,
  ): UserError | null {
    if (!value || value.trim().length < min) {
      return {
        code: 'NAME_TOO_SHORT',
        message: `${label} deve ter pelo menos ${min} caracteres.`,
        field,
      };
    }
    return null;
  }
}
