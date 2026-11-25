import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useHasPermission } from '@/features/operations/operations-permissions';
import { hasAccessIn, useItemPermission } from '../access-hooks';
import type { AccessItemData, MyAccessData } from '../access.api';

function item(id: string, enabled: boolean, permissions: string[] = []): AccessItemData {
  return {
    id,
    label: id,
    group: 'g',
    groupLabel: 'G',
    enabled,
    defaultEnabled: enabled,
    source: 'DEFAULT',
    adjustable: true,
    lockReason: null,
    permissions,
  };
}

function access(over: Partial<MyAccessData> = {}): MyAccessData {
  return {
    memberId: 'm1',
    roleName: 'MANAGER',
    permissions: ['comanda.read'],
    canManageAccess: false,
    items: [item('fin-controle', true), item('comercial-leads', true, ['commercial.manage'])],
    ...over,
  };
}

function itemPerm(itemId: string, p: string): boolean {
  return renderHook(() => useItemPermission(itemId, p)).result.current;
}

function hasPerm(p: string): boolean {
  return renderHook(() => useHasPermission(p)).result.current;
}

beforeEach(() => {
  useAuthStore.getState().clearSession();
});

describe('hasAccessIn', () => {
  it('sem acesso carregado não esconde', () => {
    expect(hasAccessIn(null, 'agenda')).toBe(true);
  });

  it('usa enabled do item; ausente = false; home sempre true', () => {
    const a = access({ items: [item('fin-controle', false)] });
    expect(hasAccessIn(a, 'fin-controle')).toBe(false);
    expect(hasAccessIn(a, 'outro')).toBe(false);
    expect(hasAccessIn(a, 'home')).toBe(true);
  });
});

describe('useItemPermission', () => {
  it('só com item ligado e permissão no item', () => {
    useAuthStore.getState().setAccess(
      access({
        items: [
          item('comercial-leads', true, ['commercial.manage']),
          item('comercial-off', false, ['commercial.manage']),
        ],
      }),
    );
    expect(itemPerm('comercial-leads', 'commercial.manage')).toBe(true);
    expect(itemPerm('comercial-leads', 'x')).toBe(false);
    expect(itemPerm('comercial-off', 'commercial.manage')).toBe(false);
  });
});

describe('useHasPermission', () => {
  it('com access usa as permissões efetivas, mesmo para ADMIN', () => {
    useAuthStore.getState().setAccess(access({ roleName: 'ADMIN', permissions: ['financial.read'] }));
    expect(hasPerm('financial.read')).toBe(true);
    useAuthStore.getState().setAccess(access({ roleName: 'ADMIN', permissions: [] }));
    expect(hasPerm('financial.read')).toBe(false);
  });

  it('sem access cai no espelho por papel', () => {
    useAuthStore.setState({ roleName: 'ADMIN' });
    expect(hasPerm('financial.read')).toBe(true);
  });
});

describe('store', () => {
  it('setAccess grava access, accessFresh, roleName e permissions', () => {
    useAuthStore.getState().setAccess(access({ roleName: 'ATTENDANT', permissions: ['a'] }));
    const s = useAuthStore.getState();
    expect(s.accessFresh).toBe(true);
    expect(s.roleName).toBe('ATTENDANT');
    expect(s.permissions).toEqual(['a']);
  });

  it('clearSession zera access e accessFresh', () => {
    useAuthStore.getState().setAccess(access());
    useAuthStore.getState().clearSession();
    const s = useAuthStore.getState();
    expect(s.access).toBeNull();
    expect(s.accessFresh).toBe(false);
  });

  it('persiste access mas não accessFresh', () => {
    useAuthStore.getState().setAccess(access());
    const saved = JSON.parse(localStorage.getItem('sgs-auth') ?? '{}').state;
    expect(saved.access).toBeTruthy();
    expect(saved.accessFresh).toBeUndefined();
  });
});
