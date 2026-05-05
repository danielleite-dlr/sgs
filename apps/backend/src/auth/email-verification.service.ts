import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuthError } from './types';

const TTL_HOURS = 24;

/**
 * EmailVerificationService — issues and consumes email verification tokens.
 *
 * Tokens are stored as SHA-256 hashes (deterministic, indexed lookup).
 * Plaintext is only returned once at issuance and sent via email.
 */
@Injectable()
export class EmailVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createToken(userId: string): Promise<{ plaintext: string }> {
    const plaintext = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000),
      },
    });
    return { plaintext };
  }

  async consumeToken(plaintext: string): Promise<{ userId: string }> {
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!row) throw new AuthError('TOKEN_INVALID', 'Verification token not recognized');
    if (row.consumedAt) throw new AuthError('TOKEN_ALREADY_USED', 'Verification token already used');
    if (row.expiresAt < new Date()) throw new AuthError('TOKEN_EXPIRED', 'Verification token expired');

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    return { userId: row.userId };
  }

  /** Most recently created token for the user (used for resend cooldown). */
  async findLatestForUser(userId: string) {
    return this.prisma.emailVerificationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
