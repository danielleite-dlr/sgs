import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import type { AccessItemData } from '@/features/access/access.api';
import {
  COMMERCIAL_ROLE_PERMISSIONS,
  canUseCommercial,
  canWinDeal,
  isCommercialManager,
  useCommercialAccess,
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

function item(id: string, enabled: boolean, permissions: string[] = []): AccessItemData {
  return {
    id,
    label: id,
    group: 'comercial',
    groupLabel: 'Comercial',
    enabled,
    defaultEnabled: enabled,
    source: 'DEFAULT',
    adjustable: true,
    lockReason: null,
    permissions,
  };
}

function setAccess(roleName: string | null, items: AccessItemData[] | null) {
  useAuthStore.setState({
    roleName,
    memberId: 'm-1',
    access: items
      ? { memberId: 'm-1', roleName: roleName ?? '', permissions: [], canManageAccess: false, items }
      : null,
  });
}

afterEach(() => useAuthStore.setState({ roleName: null, memberId: null, access: null }));

describe('useCommercialAccess por item', () => {
  const run = () => renderHook(() => useCommercialAccess()).result.current;

  it('Atendente com Relatórios ganho usa o Comercial mas não gerencia', () => {
    setAccess('ATTENDANT', [
      item('comercial-leads', true, ['commercial.read', 'commercial.write']),
      item('comercial-relatorios', true, ['commercial.read']),
    ]);
    const r = run();
    expect(r.canUse).toBe(true);
    expect(r.isManager).toBe(false);
    expect(r.canWin).toBe(true);
  });

  it('Profissional com Leads e Pipeline ganhos gerencia e pode ganhar negócio', () => {
    setAccess('PROFESSIONAL', [
      item('comercial-leads', true, ['commercial.manage']),
      item('comercial-pipeline', true, ['commercial.manage']),
    ]);
    const r = run();
    expect(r.canUse).toBe(true);
    expect(r.isManager).toBe(true);
    expect(r.canWin).toBe(true);
  });

  it('Gerente com todos os itens do Comercial desligados não usa', () => {
    setAccess('MANAGER', [item('comercial-leads', false), item('comercial-painel', false)]);
    const r = run();
    expect(r.canUse).toBe(false);
    expect(r.isManager).toBe(false);
    expect(r.canWin).toBe(false);
  });

  it('sem access segue o papel', () => {
    setAccess('MANAGER', null);
    const r = run();
    expect(r).toMatchObject({ canUse: true, isManager: true, canWin: true });
    setAccess('PROFESSIONAL', null);
    expect(run()).toMatchObject({ canUse: false, isManager: false, canWin: false });
  });
});
