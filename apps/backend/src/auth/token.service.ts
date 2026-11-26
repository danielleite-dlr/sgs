import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { isUuid } from '../database/tenant-context.service';
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
    const lookupHash = refreshLookupHash(plaintext);
    const familyUuid = familyId ?? this.newFamilyUuid();
    const ttlDays = parseTtlToDays(
      this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
    );

    const row = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        lookupHash,
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
   */
  async rotateRefresh(plaintext: string): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
  }> {
    // Revogados entram na busca: é assim que o reuso é detectado.
    const found = await this.findRefresh(plaintext, { includeRevoked: true });
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
      select: {
        id: true,
        email: true,
        isPlatformAdmin: true,
        isPlatformMaster: true,
        canAccessClientOrgs: true,
      },
    });
    const accessToken = await this.issueAccessToken({
      sub: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      isPlatformMaster: user.isPlatformMaster,
      canAccessClientOrgs:
        user.canAccessClientOrgs || user.isPlatformMaster,
      memberships,
    });

    return { accessToken, refreshToken: newRefresh.plaintext, userId: found.userId };
  }

  /**
   * Revokes a refresh token by plaintext. Idempotent — no-op if not found.
   */
  async revokeRefresh(plaintext: string): Promise<void> {
    const found = await this.findRefresh(plaintext, { includeRevoked: false });
    if (!found) return; // No-op if not found — logout should be idempotent
    await this.prisma.refreshToken.update({
      where: { id: found.id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Acha o refresh token vivo (não vencido) pelo texto.
   *
   * Caminho normal: índice único em lookup_hash (sha256) e uma única conferência
   * Argon2. Antes (quick 261126-fgp) cada logout/renovação comparava o token com
   * todos os vivos via Argon2 — ~6 s para sair com 84 sessões no staging.
   * Tokens emitidos antes da coluna (lookup_hash NULL) caem na busca antiga,
   * restrita a eles, até vencerem (30 dias) ou serem renovados.
   */
  private async findRefresh(
    plaintext: string,
    opts: { includeRevoked: boolean },
  ) {
    const now = new Date();
    const byLookup = await this.prisma.refreshToken.findUnique({
      where: { lookupHash: refreshLookupHash(plaintext) },
    });
    if (byLookup) {
      if (byLookup.expiresAt <= now) return null;
      if (!opts.includeRevoked && byLookup.revokedAt) return null;
      return (await this.password.verify(byLookup.tokenHash, plaintext)) ? byLookup : null;
    }

    const legacy = await this.prisma.refreshToken.findMany({
      where: {
        lookupHash: null,
        expiresAt: { gt: now },
        ...(opts.includeRevoked ? {} : { revokedAt: null }),
      },
      // Vivos primeiro: quem renova normalmente acha o token antes dos revogados.
      orderBy: [{ revokedAt: { sort: 'asc', nulls: 'first' } }, { issuedAt: 'desc' }],
      take: 5000,
    });
    for (const c of legacy) {
      if (await this.password.verify(c.tokenHash, plaintext)) return c;
    }
    return null;
  }

  /**
   * Mesma situação do AuthService: o refresh roda sem tenant context, então um
   * findMany em members volta vazio por causa do RLS. Ver a função
   * auth_user_memberships (migration 20260918220000).
   */
  private async loadMemberships(userId: string) {
    if (!isUuid(userId)) {
      throw new Error(`loadMemberships: invalid userId "${userId}"`);
    }
    const rows = await this.prisma.$queryRaw<
      {
        member_id: string;
        organization_id: string;
        role_name: string;
        organization_status: string;
      }[]
    >`SELECT * FROM auth_user_memberships(${userId}::uuid)`;

    return rows.map((r) => ({
      memberId: r.member_id,
      organizationId: r.organization_id,
      roleName: r.role_name,
      organizationStatus: r.organization_status,
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

/** sha256 hex do refresh token — chave de busca indexada (o token tem 512 bits aleatórios). */
export function refreshLookupHash(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}
