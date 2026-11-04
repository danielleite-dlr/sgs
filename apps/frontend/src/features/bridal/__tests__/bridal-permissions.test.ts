import { describe, expect, it } from 'vitest';
import { BRIDAL_ROLE_PERMISSIONS, roleHasBridalPermission } from '../bridal-permissions';

const ALL = [
  'bridal.read',
  'bridal.write',
  'bridal.aiSuggest',
  'contract.read',
  'contract.write',
  'contract.payment',
  'contract.cancel',
  'contract.settings',
];

describe('roleHasBridalPermission (espelha ROLE_PERMISSIONS do backend)', () => {
  it('ADMIN tem todas as permissões de noivas e contratos', () => {
    for (const p of ALL) expect(roleHasBridalPermission('ADMIN', p)).toBe(true);
  });

  it('MANAGER tem tudo, menos contract.settings', () => {
    for (const p of ALL) {
      expect(roleHasBridalPermission('MANAGER', p)).toBe(p !== 'contract.settings');
    }
  });

  it('ATTENDANT lê/escreve noivas, lê contratos e registra pagamento', () => {
    const allowed = ['bridal.read', 'bridal.write', 'contract.read', 'contract.payment'];
    for (const p of ALL) {
      expect(roleHasBridalPermission('ATTENDANT', p)).toBe(allowed.includes(p));
    }
  });

  it('PROFESSIONAL não tem nenhuma', () => {
    expect(BRIDAL_ROLE_PERMISSIONS.PROFESSIONAL).toEqual([]);
    for (const p of ALL) expect(roleHasBridalPermission('PROFESSIONAL', p)).toBe(false);
  });

  it('papel ausente ou desconhecido não tem permissão', () => {
    expect(roleHasBridalPermission(null, 'bridal.read')).toBe(false);
    expect(roleHasBridalPermission('OUTRO', 'bridal.read')).toBe(false);
  });
});
