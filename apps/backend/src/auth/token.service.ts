import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { AuthError, JwtAccessPayload } from './types';
import type { Env } from '../config/env.schema';

/**
 * TokenService — issues and rotates JWT access tokens and opaque refresh tokens.
 *
 * Access tokens: HS256, 15m TTL, signed with JWT_SECRET.
 * Refresh tokens: 64 random bytes (base64url), Argon2id-hashed for storage,
 *   30d TTL, rotate on use, family-revocation on reuse detection.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issueAccessToken(
    payload: Omit<JwtAccessPayload, 'iat' | 'exp'>,
  ): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', { infer: true }),
      algorithm: 'HS256',
    });
  }

  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    return this.jwt.verifyAsync<JwtAccessPayload>(token, {
      secret: this.config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  /**
   * Issues a new refresh token. If `familyId` is undefined, starts a new family
   * (used on login). If provided, the new token belongs to that family (rotation).
   */
  async issueRefreshToken(
    userId: string,
    familyId?: string,
  ): Promise<{ plaintext: string; tokenId: string; familyId: string }> {
    const plaintext = randomBytes(64).toString('base64url');
    const tokenHash = await this.password.hash(plaintext);
    const familyUuid = familyId ?? this.newFamilyUuid();
    const ttlDays = parseTtlToDays(
      this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
    );

    const row = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId: familyUuid,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
      select: { id: true, familyId: true },
    });
    return { plaintext, tokenId: row.id, familyId: row.familyId };
  }

  /**
   * Rotates a refresh token. On success, revokes old token and issues new one
   * in the same family. If the presented token is already revoked, triggers
   * REUSE_DETECTED: entire family is revoked as defense-in-depth.
   *
   * NOTE: Token lookup is O(N) scan over non-expired tokens (Argon2 hashes are
   * not searchable). Acceptable for Phase 1 (N << 10k). A follow-up plan will
   * add a lookup_hash column for O(1) indexed lookup.
   */
  async rotateRefresh(plaintext: string): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
  }> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { issuedAt: 'desc' },
      take: 5000,
    });

    let found: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (await this.password.verify(c.tokenHash, plaintext)) {
        found = c;
        break;
      }
    }
    if (!found) throw new AuthError('TOKEN_INVALID', 'Refresh token not recognized');

    if (found.revokedAt) {
      // REUSE detected — revoke entire family as defense-in-depth
      await this.prisma.refreshToken.updateMany({
        where: { familyId: found.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AuthError(
        'TOKEN_REUSE_DETECTED',
        'Refresh token reuse detected; family revoked',
      );
    }

    // Issue new token in same family, then mark old as revoked
    const newRefresh = await this.issueRefreshToken(found.userId, found.familyId);
    await this.prisma.refreshToken.update({
      where: { id: found.id },
      data: { revokedAt: new Date(), replacedById: newRefresh.tokenId },
    });

    // Build new access token with fresh memberships
    const memberships = await this.loadMemberships(found.userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: found.userId },
      select: { id: true, email: true },
    });
    const accessToken = await this.issueAccessToken({
      sub: user.id,
      email: user.email,
      memberships,
    });

    return { accessToken, refreshToken: newRefresh.plaintext, userId: found.userId };
  }

  /**
   * Revokes a refresh token by plaintext. Idempotent — no-op if not found.
   */
  async revokeRefresh(plaintext: string): Promise<void> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { expiresAt: { gt: new Date() }, revokedAt: null },
      take: 5000,
    });
    for (const c of candidates) {
      if (await this.password.verify(c.tokenHash, plaintext)) {
        await this.prisma.refreshToken.update({
          where: { id: c.id },
          data: { revokedAt: new Date() },
        });
        return;
      }
    }
    // No-op if not found — logout should be idempotent
  }

  private async loadMemberships(userId: string) {
    const members = await this.prisma.member.findMany({
      where: { userId, deletedAt: null, status: 'active' },
      include: { role: { select: { name: true } } },
    });
    return members.map((m) => ({
      memberId: m.id,
      organizationId: m.organizationId,
      roleName: m.role.name,
    }));
  }

  private newFamilyUuid(): string {
    // Generate a random UUID v4-shaped family ID
    const b = randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant
    const h = b.toString('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  }
}

function parseTtlToDays(ttl: string): number {
  if (ttl.endsWith('d')) return Number(ttl.slice(0, -1));
  if (ttl.endsWith('h')) return Number(ttl.slice(0, -1)) / 24;
  if (ttl.endsWith('m')) return Number(ttl.slice(0, -1)) / (24 * 60);
  return 30;
}
