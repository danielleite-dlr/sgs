import { PERMISSIONS, ROLE_PERMISSIONS } from './permissions.catalog';

describe('ROLE_PERMISSIONS — gestão da equipe (quick 261118-gpm)', () => {
  it('ADMIN e MANAGER removem membros e editam papéis', () => {
    for (const role of ['ADMIN', 'MANAGER'] as const) {
      expect(ROLE_PERMISSIONS[role]).toEqual(
        expect.arrayContaining([
          PERMISSIONS.MEMBER_REMOVE,
          PERMISSIONS.MEMBER_EDIT_ROLE,
        ]),
      );
    }
  });

  it('ATTENDANT e PROFESSIONAL continuam sem gerir a equipe', () => {
    for (const role of ['ATTENDANT', 'PROFESSIONAL'] as const) {
      expect(ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.MEMBER_REMOVE);
      expect(ROLE_PERMISSIONS[role]).not.toContain(
        PERMISSIONS.MEMBER_EDIT_ROLE,
      );
    }
  });
});
