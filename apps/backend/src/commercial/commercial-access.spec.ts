import {
  WIN_DEAL_ROLES,
  canUseCommercial,
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

  it('canUseCommercial', () => {
    expect(canUseCommercial('ADMIN')).toBe(true);
    expect(canUseCommercial('MANAGER')).toBe(true);
    expect(canUseCommercial('ATTENDANT')).toBe(true);
    expect(canUseCommercial('PROFESSIONAL')).toBe(false);
    expect(canUseCommercial(undefined)).toBe(false);
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
    const w = visibilityWhere({ roleName: 'MANAGER', memberId: 'm' });
    expect(w.deal).toEqual({ deletedAt: null });
    expect(w.lead).toEqual({ deletedAt: null });
    expect(w.reminder).toEqual({});
    expect(w.interaction).toEqual({ lead: { deletedAt: null } });
  });

  it('ADMIN tem a mesma visão do gerente', () => {
    const w = visibilityWhere({ roleName: 'ADMIN', memberId: 'x' });
    expect(w.deal).toEqual({ deletedAt: null });
  });

  it('ATTENDANT: negócios só os dela', () => {
    const w = visibilityWhere({ roleName: 'ATTENDANT', memberId: 'a' });
    expect(w.deal).toEqual({ deletedAt: null, assigneeMemberId: 'a' });
  });

  it('ATTENDANT: leads criados por ela ou com negócio dela', () => {
    const w = visibilityWhere({ roleName: 'ATTENDANT', memberId: 'a' });
    expect(w.lead).toEqual({
      deletedAt: null,
      OR: [{ createdBy: 'a' }, { deals: { some: { assigneeMemberId: 'a', deletedAt: null } } }],
    });
  });

  it('ATTENDANT: lembretes próprios ou de negócio dela', () => {
    const w = visibilityWhere({ roleName: 'ATTENDANT', memberId: 'a' });
    expect(w.reminder).toEqual({
      OR: [{ createdBy: 'a' }, { deal: { assigneeMemberId: 'a', deletedAt: null } }],
    });
  });

  it('ATTENDANT: interações pelos leads que ela vê', () => {
    const w = visibilityWhere({ roleName: 'ATTENDANT', memberId: 'a' });
    expect(w.interaction).toEqual({ lead: w.lead });
  });

  it('PROFESSIONAL lança FORBIDDEN', () => {
    expect(() => visibilityWhere({ roleName: 'PROFESSIONAL', memberId: 'p' })).toThrow(
      'FORBIDDEN',
    );
  });
});
