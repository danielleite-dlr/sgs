import { resolvePushTargets } from './resolve-push-targets';

const a1 = { id: 'a1', professionalId: 'proA' };
const a2 = { id: 'a2', professionalId: 'proB' };

const base = {
  appointments: [a1, a2],
  managerMemberIds: ['adm', 'ger'],
  activeMemberIds: new Set(['proA', 'proB', 'adm', 'ger']),
  actorMemberId: 'atendente' as string | null,
};

describe('resolvePushTargets', () => {
  it('profissionais recebem só os seus; gestoras recebem todos (D-12)', () => {
    expect(resolvePushTargets(base)).toEqual([
      { memberId: 'proA', scope: 'own', appointmentIds: ['a1'] },
      { memberId: 'proB', scope: 'own', appointmentIds: ['a2'] },
      { memberId: 'adm', scope: 'all', appointmentIds: ['a1', 'a2'] },
      { memberId: 'ger', scope: 'all', appointmentIds: ['a1', 'a2'] },
    ]);
  });

  it('o ator profissional fica de fora (D-13)', () => {
    const t = resolvePushTargets({ ...base, actorMemberId: 'proA' });
    expect(t.map((x) => x.memberId)).toEqual(['proB', 'adm', 'ger']);
  });

  it('o ator gestora fica de fora (D-13)', () => {
    const t = resolvePushTargets({ ...base, actorMemberId: 'adm' });
    expect(t.map((x) => x.memberId)).toEqual(['proA', 'proB', 'ger']);
  });

  it('profissional que também é gestora recebe um único target "all"', () => {
    const t = resolvePushTargets({ ...base, managerMemberIds: ['adm', 'proA'] });
    expect(t.filter((x) => x.memberId === 'proA')).toEqual([
      { memberId: 'proA', scope: 'all', appointmentIds: ['a1', 'a2'] },
    ]);
  });

  it('profissional inativa não recebe; gestoras continuam', () => {
    const t = resolvePushTargets({ ...base, activeMemberIds: new Set(['proA']) });
    expect(t.map((x) => x.memberId)).toEqual(['proA', 'adm', 'ger']);
  });

  it('dois atendimentos da mesma profissional viram um target, na ordem recebida', () => {
    const t = resolvePushTargets({
      ...base,
      managerMemberIds: [],
      appointments: [a1, { id: 'a3', professionalId: 'proA' }],
    });
    expect(t).toEqual([{ memberId: 'proA', scope: 'own', appointmentIds: ['a1', 'a3'] }]);
  });

  it('lista vazia devolve []', () => {
    expect(resolvePushTargets({ ...base, appointments: [] })).toEqual([]);
  });
});
