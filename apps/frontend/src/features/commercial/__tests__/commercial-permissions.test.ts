import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_ROLE_PERMISSIONS,
  canUseCommercial,
  canWinDeal,
  isCommercialManager,
} from '../commercial-permissions';
import { FEATURES, isPathEnabled } from '@/config/features';

describe('permissões do Comercial', () => {
  it('flag ligada no 09-15', () => {
    expect(FEATURES.comercial).toBe(true);
    expect(isPathEnabled('/comercial')).toBe(true);
    expect(isPathEnabled('/comercial/leads/x')).toBe(true);
    expect(isPathEnabled('/contato/org/tok')).toBe(true);
  });

  it('canUseCommercial', () => {
    expect(canUseCommercial('PROFESSIONAL')).toBe(false);
    expect(canUseCommercial('ATTENDANT')).toBe(true);
    expect(canUseCommercial(null)).toBe(false);
  });

  it('isCommercialManager', () => {
    expect(isCommercialManager('MANAGER')).toBe(true);
    expect(isCommercialManager('ATTENDANT')).toBe(false);
  });

  it('canWinDeal (D-21)', () => {
    expect(canWinDeal('ATTENDANT')).toBe(true);
    expect(canWinDeal('PROFESSIONAL')).toBe(false);
  });

  it('matriz de permissões', () => {
    expect(COMMERCIAL_ROLE_PERMISSIONS.ATTENDANT).toEqual(['commercial.read', 'commercial.write']);
    expect(COMMERCIAL_ROLE_PERMISSIONS.ADMIN).toContain('commercial.manage');
    expect(COMMERCIAL_ROLE_PERMISSIONS.MANAGER).toContain('commercial.manage');
    expect(COMMERCIAL_ROLE_PERMISSIONS.PROFESSIONAL).toEqual([]);
  });
});
