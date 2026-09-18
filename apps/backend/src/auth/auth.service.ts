import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { isUuid } from '../database/tenant-context.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailService } from '../email/email.service';
import { AuthError } from './types';
import type {
  AuthPayloadDto,
  AuthSessionDto,
  MembershipDto,
  UserError,
} from './dto/auth.payload';

/**
 * AuthService — implements all authentication mutations.
 *
 * Decision D-11: Email verification mandatory before first login.
 *
 * O cadastro público saiu daqui: quem cria organização, usuário dono e
 * membership ADMIN é o AdminService, acionado pelo platform admin.
 * Decision D-12: Creator gets ADMIN role automatically (system role lookup).
 *
 * AUTH_SKIP_EMAIL_VERIFICATION=true suspende o D-11: a conta já nasce
 * verificada e o signup devolve sessão. Existe para ambientes sem serviço de
 * e-mail configurado (staging), onde o link de verificação só apareceria no
 * log. Nunca ligar em produção.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly skipEmailVerification =
    process.env.AUTH_SKIP_EMAIL_VERIFICATION === 'true';

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
    private readonly verify: EmailVerificationService,
    private readonly email: EmailService,
  ) {}

  async verifyEmail(
    token: string,
  ): Promise<{ success: boolean; errors: UserError[] }> {
    try {
      await this.verify.consumeToken(token);
      return { success: true, errors: [] };
    } catch (e) {
      if (e instanceof AuthError) {
        return { success: false, errors: [{ code: e.code, message: e.message }] };
      }
      throw e;
    }
  }

  async resendVerification(
    email: string,
  ): Promise<{ success: boolean; cooldownSeconds: number | null; errors: UserError[] }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    // Do not leak existence of email addresses
    if (!user) return { success: true, cooldownSeconds: null, errors: [] };
    if (user.emailVerifiedAt) return { success: true, cooldownSeconds: null, errors: [] };

    // 60s cooldown between resend requests
    const last = await this.verify.findLatestForUser(user.id);
    if (last) {
      const sinceMs = Date.now() - last.createdAt.getTime();
      if (sinceMs < 60_000) {
        return {
          success: false,
          cooldownSeconds: Math.ceil((60_000 - sinceMs) / 1000),
          errors: [],
        };
      }
    }

    const { plaintext } = await this.verify.createToken(user.id);
    await this.email.sendVerification(user.email, user.fullName, plaintext);
    return { success: true, cooldownSeconds: 60, errors: [] };
  }

  async login(email: string, plaintextPassword: string): Promise<AuthPayloadDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    // Return same error for non-existent email to prevent user enumeration
    if (!user) {
      return this.errorPayload({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha incorretos.',
      });
    }

    const ok = await this.password.verify(user.passwordHash, plaintextPassword);
    if (!ok) {
      return this.errorPayload({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha incorretos.',
      });
    }

    // Com a flag ligada, contas criadas antes dela (emailVerifiedAt nulo)
    // também entram — senão ficariam presas sem e-mail para se verificar.
    if (!user.emailVerifiedAt && !this.skipEmailVerification) {
      return this.errorPayload({
        code: 'ACCOUNT_UNVERIFIED',
        message: 'Verifique seu e-mail antes de entrar.',
      });
    }

    const payload = await this.issueSession(user.id, user.email, user.fullName, {
      isPlatformAdmin: user.isPlatformAdmin,
      isPlatformMaster: user.isPlatformMaster,
      canAccessClientOrgs: user.canAccessClientOrgs || user.isPlatformMaster,
      mustChangePassword: user.mustChangePassword,
    });

    // Cliente suspenso não entra. Platform admin escapa da regra: ele não
    // depende de membership e precisa acessar justamente para resolver.
    const memberships = payload.session?.memberships ?? [];
    if (
      !user.isPlatformAdmin &&
      memberships.length > 0 &&
      memberships.every((m) => m.organizationStatus !== 'active')
    ) {
      return this.errorPayload({
        code: 'ORGANIZATION_SUSPENDED',
        message: 'Acesso suspenso. Fale com o suporte.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return payload;
  }

  /**
   * Troca de senha do próprio usuário. É o fim do ciclo da senha temporária
   * gerada pelo admin: enquanto must_change_password estiver ligado, o
   * frontend prende o usuário nessa tela.
   *
   * Exige a senha atual mesmo no primeiro acesso — o usuário acabou de
   * digitá-la para entrar, e sem isso um token vazado trocaria a senha sozinho.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; errors: UserError[] }> {
    if (newPassword.length < 8) {
      return {
        success: false,
        errors: [
          {
            code: 'PASSWORD_TOO_SHORT',
            message: 'A senha deve ter pelo menos 8 caracteres.',
            field: 'newPassword',
          },
        ],
      };
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return {
        success: false,
        errors: [{ code: 'NOT_FOUND', message: 'Usuário não encontrado.' }],
      };
    }

    const ok = await this.password.verify(user.passwordHash, currentPassword);
    if (!ok) {
      return {
        success: false,
        errors: [
          {
            code: 'INVALID_CREDENTIALS',
            message: 'Senha atual incorreta.',
            field: 'currentPassword',
          },
        ],
      };
    }

    if (await this.password.verify(user.passwordHash, newPassword)) {
      return {
        success: false,
        errors: [
          {
            code: 'PASSWORD_TOO_SHORT',
            message: 'A nova senha deve ser diferente da atual.',
            field: 'newPassword',
          },
        ],
      };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.password.hash(newPassword),
        mustChangePassword: false,
      },
    });

    return { success: true, errors: [] };
  }

  async refresh(plaintextRefresh: string): Promise<AuthPayloadDto> {
    try {
      const out = await this.tokens.rotateRefresh(plaintextRefresh);
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: out.userId },
      });
      const memberships = await this.loadMemberships(out.userId);
      const session: AuthSessionDto = {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        isPlatformAdmin: user.isPlatformAdmin,
        isPlatformMaster: user.isPlatformMaster,
        canAccessClientOrgs:
          user.canAccessClientOrgs || user.isPlatformMaster,
        mustChangePassword: user.mustChangePassword,
        impersonating: false,
        memberships,
      };
      return {
        accessToken: out.accessToken,
        refreshToken: out.refreshToken,
        session,
        errors: [],
      };
    } catch (e) {
      if (e instanceof AuthError) {
        return this.errorPayload({ code: e.code, message: e.message });
      }
      throw e;
    }
  }

  async logout(plaintextRefresh: string): Promise<{ success: boolean }> {
    await this.tokens.revokeRefresh(plaintextRefresh);
    return { success: true };
  }

  async getSession(userId: string): Promise<AuthSessionDto | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const memberships = await this.loadMemberships(userId);
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      isPlatformAdmin: user.isPlatformAdmin,
      isPlatformMaster: user.isPlatformMaster,
      canAccessClientOrgs: user.canAccessClientOrgs || user.isPlatformMaster,
      mustChangePassword: user.mustChangePassword,
      impersonating: false,
      memberships,
    };
  }

  async issueSession(
    userId: string,
    email: string,
    fullName: string,
    platform: {
      isPlatformAdmin?: boolean;
      isPlatformMaster?: boolean;
      canAccessClientOrgs?: boolean;
      mustChangePassword?: boolean;
    } = {},
  ): Promise<AuthPayloadDto> {
    const isPlatformAdmin = platform.isPlatformAdmin ?? false;
    const isPlatformMaster = platform.isPlatformMaster ?? false;
    const canAccessClientOrgs = platform.canAccessClientOrgs ?? false;
    const mustChangePassword = platform.mustChangePassword ?? false;

    const memberships = await this.loadMemberships(userId);
    const accessToken = await this.tokens.issueAccessToken({
      sub: userId,
      email,
      isPlatformAdmin,
      isPlatformMaster,
      canAccessClientOrgs,
      memberships: memberships.map((m) => ({
        memberId: m.memberId,
        organizationId: m.organizationId,
        roleName: m.roleName,
        organizationStatus: m.organizationStatus,
      })),
    });
    const { plaintext: refreshToken } = await this.tokens.issueRefreshToken(userId);
    return {
      accessToken,
      refreshToken,
      session: {
        userId,
        email,
        fullName,
        isPlatformAdmin,
        isPlatformMaster,
        canAccessClientOrgs,
        mustChangePassword,
        impersonating: false,
        memberships,
      },
      errors: [],
    };
  }

  /**
   * Memberships do usuário no login, quando ainda não existe tenant context.
   *
   * Um findMany comum aqui devolve zero linhas: members e organizations rodam
   * sob FORCE RLS com tenant_isolation contra app.current_organization, e é
   * justamente a organização que se está tentando descobrir. A função
   * auth_user_memberships (SECURITY DEFINER, criada na migration
   * 20260918220000) faz essa leitura restrita a um único user_id.
   */
  private async loadMemberships(userId: string): Promise<MembershipDto[]> {
    if (!isUuid(userId)) {
      throw new Error(`loadMemberships: invalid userId "${userId}"`);
    }
    const rows = await this.prisma.$queryRaw<
      {
        member_id: string;
        organization_id: string;
        organization_name: string;
        role_name: string;
        organization_status: string;
      }[]
    >`SELECT * FROM auth_user_memberships(${userId}::uuid)`;

    return rows.map((r) => ({
      memberId: r.member_id,
      organizationId: r.organization_id,
      organizationName: r.organization_name,
      roleName: r.role_name,
      organizationStatus: r.organization_status,
    }));
  }

  private errorPayload(err: UserError): AuthPayloadDto {
    return { accessToken: null, refreshToken: null, session: null, errors: [err] };
  }
}
