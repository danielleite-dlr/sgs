import { ACCESS_TOKEN_TTL_DAYS, hashToken, newAccessToken } from './contract-token';

describe('contract-token', () => {
  it('TTL de 30 dias', () => {
    expect(ACCESS_TOKEN_TTL_DAYS).toBe(30);
  });
  it('gera tokens distintos, base64url de 43 chars, com hash coerente', () => {
    const a = newAccessToken();
    const b = newAccessToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(a.token)).toBe(a.tokenHash);
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.tokenHash).not.toBe(a.token);
  });
});
