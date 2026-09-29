import { describe, it, expect } from 'vitest';
import { canInviteMembers, canManageMembers } from '../team-permissions';

describe('canInviteMembers', () => {
  it.each(['ADMIN', 'MANAGER'])('%s pode convidar', (role) => {
    expect(canInviteMembers(role)).toBe(true);
  });

  it.each(['ATTENDANT', 'PROFESSIONAL', 'UNKNOWN', 'admin', '', null, undefined])(
    '%s nao pode convidar',
    (role) => {
      expect(canInviteMembers(role)).toBe(false);
    },
  );
});

describe('canManageMembers', () => {
  it('somente ADMIN pode gerenciar', () => {
    expect(canManageMembers('ADMIN')).toBe(true);
  });

  it.each(['MANAGER', 'ATTENDANT', 'PROFESSIONAL', 'UNKNOWN', 'admin', '', null, undefined])(
    '%s nao pode gerenciar',
    (role) => {
      expect(canManageMembers(role)).toBe(false);
    },
  );
});
