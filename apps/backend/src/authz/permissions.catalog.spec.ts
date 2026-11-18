import { PERMISSIONS, ROLE_PERMISSIONS } from './permissions.catalog';

describe('ROLE_PERMISSIONS — fase 9', () => {
  it('ADMIN e MANAGER têm commercial.read, write e manage', () => {
    for (const role of ['ADMIN', 'MANAGER'] as const) {
      expect(ROLE_PERMISSIONS[role]).toEqual(
        expect.arrayContaining([
          PERMISSIONS.COMMERCIAL_READ,
          PERMISSIONS.COMMERCIAL_WRITE,
          PERMISSIONS.COMMERCIAL_MANAGE,
        ]),
      );
    }
  });

  it('ATTENDANT tem read e write, mas não manage', () => {
    expect(ROLE_PERMISSIONS.ATTENDANT).toContain('commercial.read');
    expect(ROLE_PERMISSIONS.ATTENDANT).toContain('commercial.write');
    expect(ROLE_PERMISSIONS.ATTENDANT).not.toContain('commercial.manage');
  });

  it('PROFESSIONAL não tem nenhuma permissão commercial.*', () => {
    expect(
      ROLE_PERMISSIONS.PROFESSIONAL.filter((p) => p.startsWith('commercial.')),
    ).toEqual([]);
  });

  it('ATTENDANT continua sem contract.write (o ganho não depende dela)', () => {
    expect(ROLE_PERMISSIONS.ATTENDANT).not.toContain('contract.write');
  });
});
