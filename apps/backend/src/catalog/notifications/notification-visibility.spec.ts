import type { ResolvedAccess } from '../../authz/access/access-resolve';
import { ALERT_KINDS } from '../../contracts/alerts/alert-candidates';
import { hiddenNotificationKinds } from './notification-visibility';

function accessWith(enabled: Record<string, boolean>): ResolvedAccess {
  const items = new Map(
    Object.entries(enabled).map(([id, on]) => [
      id,
      {
        id,
        enabled: on,
        defaultEnabled: on,
        source: 'DEFAULT' as const,
        permissions: new Set<string>(),
      },
    ]),
  );
  return {
    roleName: 'MANAGER',
    rolePermissions: new Set<string>(),
    items,
    permissions: new Set<string>(),
  };
}

describe('10 — hiddenNotificationKinds', () => {
  it('gerente completo não esconde nada', () => {
    const full = accessWith({ 'produtos-todos': true, contratos: true });
    expect(hiddenNotificationKinds(full)).toEqual([]);
  });

  it('sem produtos-todos esconde stock_low', () => {
    const a = accessWith({ 'produtos-todos': false, contratos: true });
    expect(hiddenNotificationKinds(a)).toEqual(['stock_low']);
  });

  it('sem contratos esconde todos os alertas de contrato', () => {
    const a = accessWith({ 'produtos-todos': true, contratos: false });
    expect(hiddenNotificationKinds(a)).toEqual([...ALERT_KINDS]);
  });

  it('item ausente conta como desligado', () => {
    expect(hiddenNotificationKinds(accessWith({}))).toEqual(['stock_low', ...ALERT_KINDS]);
  });

  it('sem acesso carregado não esconde nada (o guard já recusa antes)', () => {
    expect(hiddenNotificationKinds(null)).toEqual([]);
  });
});
