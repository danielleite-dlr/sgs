/**
 * Quick 261126-fgp — busca indexada do refresh token (lookup_hash = sha256).
 *
 * Logout e renovação comparavam o token com todos os vivos via Argon2 (~6 s para sair no
 * staging). Agora acham pelo índice; tokens antigos (lookup_hash NULL) seguem pela busca antiga.
 */
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { TokenService, refreshLookupHash } from '../../src/auth/token.service';
import { AuthError } from '../../src/auth/types';
import { adminPrisma } from './setup';

const EMAIL = `fgp-lookup-${Date.now()}@test.com`;

async function cleanup() {
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'fgp-lookup-%')`,
  );
  await adminPrisma.$executeRawUnsafe(`DELETE FROM users WHERE email LIKE 'fgp-lookup-%'`);
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof AuthError ? e.code : String(e);
  }
}

describe('refresh token com busca indexada (quick 261126-fgp)', () => {
  let moduleRef: TestingModule;
  let tokens: TokenService;
  let userId: string;

  beforeAll(async () => {
    await cleanup();
    const user = await adminPrisma.user.create({
      data: { email: EMAIL, passwordHash: 'x', fullName: 'Lookup Teste' },
    });
    userId = user.id;
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    tokens = moduleRef.get(TokenService);
  }, 60000);

  afterAll(async () => {
    if (moduleRef) await moduleRef.close();
    await cleanup();
  });

  it('token novo grava lookup_hash = sha256 do texto', async () => {
    const issued = await tokens.issueRefreshToken(userId);
    const row = await adminPrisma.refreshToken.findUniqueOrThrow({ where: { id: issued.tokenId } });
    expect(row.lookupHash).toBe(refreshLookupHash(issued.plaintext));
    expect(row.lookupHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('renova pelo índice e o token velho reusado revoga a família', async () => {
    const issued = await tokens.issueRefreshToken(userId);
    const out = await tokens.rotateRefresh(issued.plaintext);
    expect(out.refreshToken).not.toBe(issued.plaintext);
    const old = await adminPrisma.refreshToken.findUniqueOrThrow({ where: { id: issued.tokenId } });
    expect(old.revokedAt).not.toBeNull();

    expect(await codeOf(tokens.rotateRefresh(issued.plaintext))).toBe('TOKEN_REUSE_DETECTED');
    const family = await adminPrisma.refreshToken.findMany({
      where: { familyId: issued.familyId },
    });
    expect(family.every((t) => t.revokedAt !== null)).toBe(true);
  }, 30000);

  it('logout revoga pelo índice e é idempotente', async () => {
    const issued = await tokens.issueRefreshToken(userId);
    await tokens.revokeRefresh(issued.plaintext);
    const row = await adminPrisma.refreshToken.findUniqueOrThrow({ where: { id: issued.tokenId } });
    expect(row.revokedAt).not.toBeNull();
    await expect(tokens.revokeRefresh(issued.plaintext)).resolves.toBeUndefined();
  });

  it('token vencido achado pelo índice é recusado', async () => {
    const issued = await tokens.issueRefreshToken(userId);
    await adminPrisma.refreshToken.update({
      where: { id: issued.tokenId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await codeOf(tokens.rotateRefresh(issued.plaintext))).toBe('TOKEN_INVALID');
  });

  it('token antigo sem lookup_hash ainda renova e sai pela busca antiga', async () => {
    const a = await tokens.issueRefreshToken(userId);
    await adminPrisma.refreshToken.update({ where: { id: a.tokenId }, data: { lookupHash: null } });
    const out = await tokens.rotateRefresh(a.plaintext);
    const novo = await adminPrisma.refreshToken.findFirstOrThrow({
      where: { lookupHash: refreshLookupHash(out.refreshToken) },
    });
    expect(novo.familyId).toBe(a.familyId);

    const b = await tokens.issueRefreshToken(userId);
    await adminPrisma.refreshToken.update({ where: { id: b.tokenId }, data: { lookupHash: null } });
    await tokens.revokeRefresh(b.plaintext);
    const rowB = await adminPrisma.refreshToken.findUniqueOrThrow({ where: { id: b.tokenId } });
    expect(rowB.revokedAt).not.toBeNull();
  }, 30000);
});
