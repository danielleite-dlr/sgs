import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
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
 * Decision D-09: Signup creates User + Organization in one sequential flow.
 * Decision D-10: Collects only fullName, email, password, salonName.
 * Decision D-11: Email verification mandatory before first login.
 * Decision D-12: Creator gets ADMIN role automatically (system role lookup).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
    private readonly verify: EmailVerificationService,
    private readonly email: EmailService,
  ) {}

  async signup(input: {
    fullName: string;
    email: string;
    password: string;
    salonName: string;
    segment?: string;
  }): Promise<AuthPayloadDto> {
    const emailLower = input.email.toLowerCase();

    // Pre-check: email already registered?
    const existing = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing) {
      return this.errorPayload({
        code: 'EMAIL_TAKEN',
        message: 'E-mail já cadastrado.',
        field: 'email',
      });
    }

    // Validate password length (class-validator handles this in resolver, but
    // service enforces independently for direct callers)
    if (input.password.length < 8) {
      return this.errorPayload({
        code: 'PASSWORD_TOO_SHORT',
        message: 'A senha deve ter pelo menos 8 caracteres.',
        field: 'password',
      });
    }

    if (!input.salonName || input.salonName.trim().length < 2) {
      return this.errorPayload({
        code: 'NAME_TOO_SHORT',
        message: 'O nome do salão deve ter pelo menos 2 caracteres.',
        field: 'salonName',
      });
    }

    const hash = await this.password.hash(input.password);

    // Look up system ADMIN role (created by plan 01-02 seed)
    const adminRole = await this.prisma.role.findFirstOrThrow({
      where: { name: 'ADMIN', isSystem: true },
    });

    let createdUserId = '';
    let verificationToken = '';

    // Create User + Organization + Member atomically (D-09)
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash: hash,
          fullName: input.fullName,
        },
      });
      createdUserId = user.id;

      // Generate a unique subdomain slug
      const baseSlug = input.salonName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      const subdomain = `${baseSlug || 'salao'}-${Date.now().toString(36)}`;

      const org = await tx.organization.create({
        data: {
          legalName: input.salonName,
          tradeName: input.salonName,
          documentType: 'CNPJ', // placeholder — collected in onboarding (D-10)
          documentNumber: Date.now().toString().slice(-14), // unique 14-char placeholder; org admin fills CNPJ in onboarding
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
          displayName: input.fullName,
          isProfessional: false,
          status: 'active',
        },
      });
    });

    // Issue verification token AFTER transaction commits (Phase 1 acceptable;
    // if this fails user can request resend. See plan notes for v2 hardening.)
    try {
      const { plaintext } = await this.verify.createToken(createdUserId);
      verificationToken = plaintext;
    } catch (e) {
      this.logger.error(
        `Verification token creation failed for user=${createdUserId}: ${(e as Error).message}`,
      );
    }

    // Send verification email after commit (best-effort; user can resend)
    if (verificationToken) {
      try {
        await this.email.sendVerification(
          emailLower,
          input.fullName,
          verificationToken,
        );
      } catch (e) {
        this.logger.error(
          `Verification email send failed for user=${createdUserId}: ${(e as Error).message}`,
        );
        // Do NOT fail signup if email send fails — user can request resend
      }
    }

    // Per D-11: no tokens returned until email verified
    return { accessToken: null, refreshToken: null, session: null, errors: [] };
  }

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

    if (!user.emailVerifiedAt) {
      return this.errorPayload({
        code: 'ACCOUNT_UNVERIFIED',
        message: 'Verifique seu e-mail antes de entrar.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueSession(user.id, user.email, user.fullName);
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
      memberships,
    };
  }

  async issueSession(
    userId: string,
    email: string,
    fullName: string,
  ): Promise<AuthPayloadDto> {
    const memberships = await this.loadMemberships(userId);
    const accessToken = await this.tokens.issueAccessToken({
      sub: userId,
      email,
      memberships: memberships.map((m) => ({
        memberId: m.memberId,
        organizationId: m.organizationId,
        roleName: m.roleName,
      })),
    });
    const { plaintext: refreshToken } = await this.tokens.issueRefreshToken(userId);
    return {
      accessToken,
      refreshToken,
      session: { userId, email, fullName, memberships },
      errors: [],
    };
  }

  private async loadMemberships(userId: string): Promise<MembershipDto[]> {
    const members = await this.prisma.member.findMany({
      where: { userId, deletedAt: null, status: 'active' },
      include: {
        role: { select: { name: true } },
        organization: { select: { id: true, tradeName: true } },
      },
    });
    return members.map((m) => ({
      memberId: m.id,
      organizationId: m.organization.id,
      organizationName: m.organization.tradeName,
      roleName: m.role.name,
    }));
  }

  private errorPayload(err: UserError): AuthPayloadDto {
    return { accessToken: null, refreshToken: null, session: null, errors: [err] };
  }
}
