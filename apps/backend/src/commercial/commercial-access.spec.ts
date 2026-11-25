import { resolveAccess } from '../authz/access/access-resolve';
import {
  WIN_DEAL_ROLES,
  canWinAs,
  commercialViewerFrom,
  canWinDeal,
  isManagerRole,
  visibilityWhere,
} from './commercial-access';

describe('papéis do Comercial', () => {
  it('isManagerRole', () => {
    expect(isManagerRole('ADMIN')).toBe(true);
    expect(isManagerRole('MANAGER')).toBe(true);
    expect(isManagerRole('ATTENDANT')).toBe(false);
    expect(isManagerRole('PROFESSIONAL')).toBe(false);
    expect(isManagerRole('')).toBe(false);
    expect(isManagerRole(null)).toBe(false);
  });

  it('canWinDeal (D-21): atendente pode, profissional não', () => {
    expect(WIN_DEAL_ROLES).toEqual(['ADMIN', 'MANAGER', 'ATTENDANT']);
    expect(canWinDeal('ADMIN')).toBe(true);
    expect(canWinDeal('MANAGER')).toBe(true);
    expect(canWinDeal('ATTENDANT')).toBe(true);
    expect(canWinDeal('PROFESSIONAL')).toBe(false);
    expect(canWinDeal(null)).toBe(false);
  });
});

describe('visibilityWhere', () => {
  it('MANAGER vê tudo que não foi excluído', () => {
    const w = visibilityWhere({ roleName: 'MANAGER', memberId: 'm', scopeAll: false });
    expect(w.deal).toEqual({ deletedAt: null });
    expect(w.lead).toEqual({ deletedAt: null });
    expect(w.reminder).toEqual({});
    expect(w.interaction).toEqual({ lead: { deletedAt: null } });
  });

  it('ADMIN tem a mesma visão do gerente', () => {
    const w = visibilityWhere({ roleName: 'ADMIN', memberId: 'x', scopeAll: false });
    expect(w.deal).toEqual({ deletedAt: null });
  });

  it('ATTENDANT: negócios só os dela', () => {
    const w = visibilityWhere({ roleName: 'ATTENDANT', memberId: 'a', scopeAll: false });
    expect(w.deal).toEqual({ deletedAt: null, assigneeMemberId: 'a' });
  });

  it('ATTENDANT: leads criados por ela ou com negócio dela', () => {
    const w = visibilityWhere({ roleName: 'ATTENDANT', memberId: 'a', scopeAll: false });
    expect(w.lead).toEqual({
      deletedAt: null,
      OR: [{ createdBy: 'a' }, { deals: { some: { assigneeMemberId: 'a', deletedAt: null } } }],
    });
  });

  it('ATTENDANT: lembretes próprios ou de negócio dela', () => {
    const w = visibilityWhere({ roleName: 'ATTENDANT', memberId: 'a', scopeAll: false });
    expect(w.reminder).toEqual({
      OR: [{ createdBy: 'a' }, { deal: { assigneeMemberId: 'a', deletedAt: null } }],
    });
  });

  it('ATTENDANT: interações pelos leads que ela vê', () => {
    const w = visibilityWhere({ roleName: 'ATTENDANT', memberId: 'a', scopeAll: false });
    expect(w.interaction).toEqual({ lead: w.lead });
  });

  it('PROFESSIONAL lança FORBIDDEN', () => {
    expect(() =>
      visibilityWhere({ roleName: 'PROFESSIONAL', memberId: 'p', scopeAll: false }),
    ).toThrow('FORBIDDEN');
  });
});

describe('scopeAll (fase 10)', () => {
  const ATT_PERMS = ['commercial.read', 'commercial.write'];
  const MGR_PERMS = ['commercial.read', 'commercial.write', 'commercial.manage'];
  const accessOf = (roleName: string, perms: string[], granted: string[] = []) =>
    resolveAccess({
      roleName,
      rolePermissions: perms,
      overrides: granted.map((itemId) => ({ itemId, enabled: true })),
    });

  it('PROFESSIONAL/ATTENDANT com scopeAll veem como o Gerente', () => {
    const gerente = visibilityWhere({ roleName: 'MANAGER', memberId: 'm', scopeAll: false });
    expect(visibilityWhere({ roleName: 'PROFESSIONAL', memberId: 'p', scopeAll: true })).toEqual(
      gerente,
    );
    expect(visibilityWhere({ roleName: 'ATTENDANT', memberId: 'a', scopeAll: true })).toEqual(
      gerente,
    );
  });

  it('PROFESSIONAL sem scopeAll lança FORBIDDEN', () => {
    expect(() =>
      visibilityWhere({ roleName: 'PROFESSIONAL', memberId: 'p', scopeAll: false }),
    ).toThrow('FORBIDDEN');
  });

  it('atendente com Relatórios ganho: scopeAll só na operação de relatórios', () => {
    const acc = accessOf('ATTENDANT', ATT_PERMS, ['comercial-relatorios']);
    expect(commercialViewerFrom(acc, 'a', ['comercial-relatorios']).scopeAll).toBe(true);
    expect(commercialViewerFrom(acc, 'a', ['comercial-leads', 'comercial-pipeline']).scopeAll).toBe(
      false,
    );
  });

  it('gerente tem scopeAll em qualquer operação', () => {
    const acc = accessOf('MANAGER', MGR_PERMS);
    expect(commercialViewerFrom(acc, 'g', ['comercial-leads']).scopeAll).toBe(true);
  });

  it('canWinAs', () => {
    expect(canWinAs({ roleName: 'PROFESSIONAL', scopeAll: true })).toBe(true);
    expect(canWinAs({ roleName: 'PROFESSIONAL', scopeAll: false })).toBe(false);
    expect(canWinAs({ roleName: 'ATTENDANT', scopeAll: false })).toBe(true);
  });
});
