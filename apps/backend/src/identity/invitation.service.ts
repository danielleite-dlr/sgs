import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { PasswordService } from '../auth/password.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { AuthError } from '../auth/types';
import type { AuthPayloadDto } from '../auth/dto/auth.payload';

const TTL_DAYS = 7;

/**
 * InvitationService — manages the full member invitation lifecycle.
 *
 * invite():
 *  - Creates a member_invitations row with a SHA-256 token hash
 *  - Sends the plaintext token to the invitee via email
 *  - Token is NEVER returned in the API response (security)
 *
 * accept():
 *  - Looks up invitation by token hash using a raw query
 *    (member_invitations SELECT policy is intentionally relaxed to USING(true)
 *     because the token_hash IS the secret; see migration 20260502010000)
 *  - Creates User (if new) + Member atomically via TenantContextService.runWithTenant
 *  - Consumes the invitation in the same transaction
 *  - Issues a full auth session immediately (user is logged in after accepting)
 */
@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly password: PasswordService,
    private readonly auth: AuthService,
    private readonly email: EmailService,
  ) {}

  async invite(args: {
    organizationId: string;
    invitedById: string;
    inviterName: string;
    salonName: string;
    email: string;
    roleName: string;
  }): Promise<{ invitationId: string; expiresAt: Date }> {
    const lowercaseEmail = args.email.toLowerCase();

    // Pre-checks: scope by organizationId in WHERE to avoid cross-tenant leaks
    const existingMember = await this.prisma.member.findFirst({
      where: {
        organizationId: args.organizationId,
        user: { email: lowercaseEmail },
        deletedAt: null,
      },
    });
    if (existingMember) {
      throw new AuthError(
        'EMAIL_TAKEN',
        'Este e-mail já é membro desta organização',
      );
    }

    const pending = await this.prisma.memberInvitation.findFirst({
      where: {
        organizationId: args.organizationId,
        email: lowercaseEmail,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (pending) {
      throw new AuthError(
        'INVITATION_USED',
        'Já existe um convite pendente para este e-mail',
      );
    }

    const role = await this.prisma.role.findFirstOrThrow({
      where: { name: args.roleName, isSystem: true },
    });

    const plaintext = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const expiresAt = new Date(
      Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.tenant.runWithTenant(
      args.organizationId,
      async (tx) => {
        return tx.memberInvitation.create({
          data: {
            organizationId: args.organizationId,
            email: lowercaseEmail,
            roleId: role.id,
            tokenHash,
            invitedById: args.invitedById,
            expiresAt,
          },
          select: { id: true, expiresAt: true },
        });
      },
    );

    // Send email outside transaction (best-effort; token already persisted)
    await this.email.sendInvitation(
      lowercaseEmail,
      args.salonName,
      args.inviterName,
      plaintext,
    );

    return { invitationId: invitation.id, expiresAt: invitation.expiresAt };
  }

  async accept(
    token: string,
    fullName: string,
    password: string,
  ): Promise<AuthPayloadDto> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find invitation across all tenants via raw query.
    // member_invitations SELECT policy is USING(true) — see migration 20260502010000.
    // The token_hash is the secret; the application always queries by hash equality (never enumerates).
    const inv = await this.prisma.$queryRaw<
      Array<{
        id: string;
        organization_id: string;
        email: string;
        role_id: string;
        expires_at: Date;
        accepted_at: Date | null;
        revoked_at: Date | null;
      }>
    >`
      SELECT id, organization_id, email, role_id, expires_at, accepted_at, revoked_at
      FROM member_invitations
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;
    const row = inv[0];
    if (!row) throw new AuthError('TOKEN_INVALID', 'Convite não encontrado');
    if (row.accepted_at)
      throw new AuthError('INVITATION_USED', 'Este convite já foi utilizado');
    if (row.revoked_at)
      throw new AuthError('TOKEN_INVALID', 'Convite revogado');
    if (row.expires_at < new Date())
      throw new AuthError('INVITATION_EXPIRED', 'Este convite expirou');

    const passwordHash = await this.password.hash(password);

    // Find or create user — email already lowercased by invite()
    let userId: string;
    const existingUser = await this.prisma.user.findUnique({
      where: { email: row.email },
    });
    if (existingUser) {
      userId = existingUser.id;
      // Mark email verified — accepting the invite implies email control
      if (!existingUser.emailVerifiedAt) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { emailVerifiedAt: new Date() },
        });
      }
    } else {
      const created = await this.prisma.user.create({
        data: {
          email: row.email,
          fullName,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      });
      userId = created.id;
    }

    // Create membership + consume invitation in a single tenant-scoped transaction
    await this.tenant.runWithTenant(row.organization_id, async (tx) => {
      await tx.member.create({
        data: {
          organizationId: row.organization_id,
          userId,
          roleId: row.role_id,
          displayName: fullName,
          status: 'active',
        },
      });
      await tx.memberInvitation.update({
        where: { id: row.id },
        data: { acceptedAt: new Date() },
      });
    });

    // Issue session for the new/existing user immediately (user is logged in)
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.auth.issueSession(user.id, user.email, user.fullName);
  }
}
