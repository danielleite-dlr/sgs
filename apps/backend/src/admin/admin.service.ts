import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { isUuid } from '../database/tenant-context.service';
import { PasswordService } from '../auth/password.service';
import type { UserError } from '../auth/dto/auth.payload';

export interface AdminClientDto {
  organizationId: string;
  tradeName: string;
  legalName: string;
  email: string;
  subdomain: string;
  segment: string;
  status: string;
  createdAt: Date;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLastLoginAt: Date | null;
  memberCount: number;
}

export interface CreateClientResult {
  client: AdminClientDto | null;
  errors: UserError[];
}

/**
 * AdminService — operações do painel de plataforma.
 *
 * É aqui que nasce um cliente: a organização, o usuário dono e a membership
 * ADMIN dele. Antes isso vinha do signup público, que foi removido; agora só
 * um platform admin cadastra.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
  ) {}

  /**
   * Lista os clientes da plataforma.
   *
   * organizations e members são tenant-scoped sob FORCE RLS e o platform admin
   * não tem tenant nenhum, então a leitura sai pela função admin_list_clients
   * (SECURITY DEFINER), que reconfere o papel do chamador no banco.
   */
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
        subdomain: string;
        segment: string;
        status: string;
        created_at: Date;
        owner_user_id: string | null;
        owner_name: string | null;
        owner_email: string | null;
        owner_last_login: Date | null;
        member_count: bigint;
      }[]
    >`SELECT * FROM admin_list_clients(${adminUserId}::uuid)`;

    return rows.map((r) => ({
      organizationId: r.organization_id,
      tradeName: r.trade_name,
      legalName: r.legal_name,
      email: r.email,
      subdomain: r.subdomain,
      segment: r.segment,
      status: r.status,
      createdAt: r.created_at,
      ownerUserId: r.owner_user_id,
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      ownerLastLoginAt: r.owner_last_login,
      memberCount: Number(r.member_count),
    }));
  }

  /**
   * Cria um cliente: organização + usuário dono + membership ADMIN, numa única
   * transação.
   *
   * A conta já nasce com emailVerifiedAt preenchido: quem cadastrou foi o
   * platform admin, então não há e-mail a confirmar. A senha inicial é definida
   * aqui e repassada ao cliente por fora.
   */
  async createClient(input: {
    salonName: string;
    ownerName: string;
    ownerEmail: string;
    password: string;
    segment?: string;
  }): Promise<CreateClientResult> {
    const emailLower = input.ownerEmail.trim().toLowerCase();

    if (!input.salonName || input.salonName.trim().length < 2) {
      return {
        client: null,
        errors: [
          {
            code: 'NAME_TOO_SHORT',
            message: 'O nome do salão deve ter pelo menos 2 caracteres.',
            field: 'salonName',
          },
        ],
      };
    }

    if (!input.ownerName || input.ownerName.trim().length < 2) {
      return {
        client: null,
        errors: [
          {
            code: 'NAME_TOO_SHORT',
            message: 'O nome do responsável deve ter pelo menos 2 caracteres.',
            field: 'ownerName',
          },
        ],
      };
    }

    if (input.password.length < 8) {
      return {
        client: null,
        errors: [
          {
            code: 'PASSWORD_TOO_SHORT',
            message: 'A senha deve ter pelo menos 8 caracteres.',
            field: 'password',
          },
        ],
      };
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing) {
      return {
        client: null,
        errors: [
          {
            code: 'EMAIL_TAKEN',
            message: 'E-mail já cadastrado.',
            field: 'ownerEmail',
          },
        ],
      };
    }

    const hash = await this.password.hash(input.password);
    const adminRole = await this.prisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash: hash,
          fullName: input.ownerName.trim(),
          // Cadastro feito pelo platform admin: não há e-mail a confirmar.
          emailVerifiedAt: new Date(),
        },
      });

      const baseSlug = input.salonName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      const subdomain = `${baseSlug || 'salao'}-${Date.now().toString(36)}`;

      // organizations e members rodam sob FORCE RLS com tenant_isolation contra
      // app.current_organization. A linha ainda não existe, então deixar o banco
      // gerar o id faria o WITH CHECK falhar (42501): reserva o id, seta o
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
      `admin: cliente criado org=${created.org.id} owner=${created.user.id}`,
    );

    return {
      client: {
        organizationId: created.org.id,
        tradeName: created.org.tradeName,
        legalName: created.org.legalName,
        email: created.org.email,
        subdomain: created.org.subdomain,
        segment: created.org.segment,
        status: created.org.status,
        createdAt: created.org.createdAt,
        ownerUserId: created.user.id,
        ownerName: created.user.fullName,
        ownerEmail: created.user.email,
        ownerLastLoginAt: null,
        memberCount: 1,
      },
      errors: [],
    };
  }
}
