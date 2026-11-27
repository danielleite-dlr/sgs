import { ACCESS_ITEMS } from './access-catalog';
import { itemAdjustability, targetLock } from './access-admin-rules';
import { resolveAccess } from './access-resolve';

const item = (id: string) => ACCESS_ITEMS.find((i) => i.id === id)!;

describe('targetLock', () => {
  const base = { actorId: 'a', targetId: 'b' };

  it('Admin no Admin', () => {
    expect(
      targetLock({ ...base, actorRole: 'ADMIN', targetRole: 'ADMIN' }),
    ).toEqual({
      code: 'ACCESS_TARGET_ADMIN',
      message: 'O Administrador sempre tem todos os acessos.',
    });
  });

  it.each(['ADMIN', 'MANAGER'])('%s no Assistente', (actorRole) => {
    expect(
      targetLock({ ...base, actorRole, targetRole: 'ASSISTANT' }),
    ).toMatchObject({ code: 'ACCESS_TARGET_ASSISTANT' });
  });

  it.each(['MANAGER', 'ATTENDANT', 'PROFESSIONAL'])('Admin em %s', (r) => {
    expect(
      targetLock({ ...base, actorRole: 'ADMIN', targetRole: r }),
    ).toBeNull();
  });

  it.each(['ATTENDANT', 'PROFESSIONAL'])('Gerente em %s', (r) => {
    expect(
      targetLock({ ...base, actorRole: 'MANAGER', targetRole: r }),
    ).toBeNull();
  });

  it('Gerente em Gerente, em si mesmo e no Admin', () => {
    expect(
      targetLock({ ...base, actorRole: 'MANAGER', targetRole: 'MANAGER' }),
    ).toEqual({
      code: 'ACCESS_TARGET_FORBIDDEN',
      message: 'O Gerente ajusta só Atendentes e Profissionais.',
    });
    expect(
      targetLock({
        actorRole: 'MANAGER',
        actorId: 'a',
        targetRole: 'MANAGER',
        targetId: 'a',
      }),
    ).toEqual({
      code: 'ACCESS_TARGET_SELF',
      message: 'Ninguém ajusta os próprios acessos.',
    });
    expect(
      targetLock({ ...base, actorRole: 'MANAGER', targetRole: 'ADMIN' })?.code,
    ).toBe('ACCESS_TARGET_ADMIN');
  });

  it.each(['ATTENDANT', 'PROFESSIONAL'])('%s não ajusta ninguém', (r) => {
    expect(
      targetLock({ ...base, actorRole: r, targetRole: 'ATTENDANT' })?.code,
    ).toBe('ACCESS_TARGET_FORBIDDEN');
  });
});

describe('itemAdjustability', () => {
  const admin = resolveAccess({
    roleName: 'ADMIN',
    rolePermissions: [],
    overrides: [],
  });
  const manager = (overrides: { itemId: string; enabled: boolean }[]) =>
    resolveAccess({
      roleName: 'MANAGER',
      rolePermissions: ACCESS_ITEMS.flatMap((i) => [...i.requires]),
      overrides,
    });

  it('Perfis de acesso não liga para Atendente', () => {
    expect(
      itemAdjustability(
        admin,
        'ATTENDANT',
        item('profissionais-perfis'),
        false,
      ),
    ).toEqual({
      adjustable: false,
      lockReason: 'Perfis de acesso fica só com Administrador e Gerente.',
    });
  });

  it('Gerente sem o item não concede, mas desliga', () => {
    const m = manager([{ itemId: 'fin-controle', enabled: false }]);
    expect(
      itemAdjustability(m, 'ATTENDANT', item('fin-controle'), false),
    ).toEqual({
      adjustable: false,
      lockReason: 'Você não tem este acesso, então não pode concedê-lo.',
    });
    expect(
      itemAdjustability(m, 'ATTENDANT', item('fin-controle'), true).adjustable,
    ).toBe(true);
  });

  it('Admin ajusta fin-controle', () => {
    expect(
      itemAdjustability(admin, 'ATTENDANT', item('fin-controle'), false),
    ).toEqual({ adjustable: true, lockReason: null });
  });
});
