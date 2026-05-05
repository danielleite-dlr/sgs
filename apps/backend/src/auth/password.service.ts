import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * PasswordService — Argon2id hashing and verification.
 * Parameters follow OWASP Password Storage Cheat Sheet 2024:
 *   - Algorithm: Argon2id (hybrid, OWASP recommended)
 *   - Memory: 19 MiB (19456 KiB)
 *   - Iterations: 2
 *   - Parallelism: 1
 */
@Injectable()
export class PasswordService {
  private readonly opts: argon2.Options & { raw?: false } = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB — OWASP 2024
    timeCost: 2,
    parallelism: 1,
  };

  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, this.opts);
  }

  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext, this.opts);
    } catch {
      return false;
    }
  }
}
