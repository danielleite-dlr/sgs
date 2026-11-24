import {
  isTrialSettledAtEvent,
  linkableTrialContract,
  splitTrialCommission,
  type TrialLinkItem,
} from './comanda-trial-link';

const CONTRACT = { id: 'k1', code: 'CT-2026-008', status: 'draft' };

function item(over: Partial<TrialLinkItem> = {}, appt: Partial<NonNullable<TrialLinkItem['appointment']>> = {}): TrialLinkItem {
  return {
    kind: 'service',
    contractId: null,
    appointment: {
      purpose: 'trial',
      clientId: 'c1',
      bridalGroup: {
        members: [{ clientId: 'c1', coveredByContract: true }],
        contracts: [CONTRACT],
      },
      ...appt,
    },
    ...over,
  };
}

describe('linkableTrialContract (261117-i6j)', () => {
  it('teste de noiva coberta sem contrato no item -> contrato vivo do grupo', () => {
    expect(linkableTrialContract(item())).toEqual({ id: 'k1', code: 'CT-2026-008' });
  });

  it('já ligado -> null', () => {
    expect(linkableTrialContract(item({ contractId: 'k1' }))).toBeNull();
  });

  it('atendimento do evento ou fora de grupo -> null', () => {
    expect(linkableTrialContract(item({}, { purpose: 'event' }))).toBeNull();
    expect(linkableTrialContract(item({}, { purpose: null, bridalGroup: null }))).toBeNull();
    expect(linkableTrialContract(item({ appointment: null }))).toBeNull();
  });

  it('produto -> null', () => {
    expect(linkableTrialContract(item({ kind: 'product' }))).toBeNull();
  });

  it('cliente não coberta pelo contrato -> null', () => {
    const members = [{ clientId: 'c1', coveredByContract: false }];
    expect(
      linkableTrialContract(item({}, { bridalGroup: { members, contracts: [CONTRACT] } })),
    ).toBeNull();
  });

  it('só contrato cancelado ou nenhum -> null', () => {
    const members = [{ clientId: 'c1', coveredByContract: true }];
    const cancelled = [{ ...CONTRACT, status: 'cancelled' }];
    expect(linkableTrialContract(item({}, { bridalGroup: { members, contracts: cancelled } }))).toBeNull();
    expect(linkableTrialContract(item({}, { bridalGroup: { members, contracts: [] } }))).toBeNull();
  });
});

describe('isTrialSettledAtEvent (261117-j1w)', () => {
  const trial = { purpose: 'trial' };
  it('teste coberto a R$ 0,00 -> pago no evento (sem comissão no teste)', () => {
    expect(isTrialSettledAtEvent({ contractId: 'k1', totalCents: 0, appointment: trial })).toBe(true);
  });
  it('teste avulso, teste com valor ou evento -> false', () => {
    expect(isTrialSettledAtEvent({ contractId: null, totalCents: 0, appointment: trial })).toBe(false);
    expect(isTrialSettledAtEvent({ contractId: 'k1', totalCents: 15000, appointment: trial })).toBe(false);
    expect(
      isTrialSettledAtEvent({ contractId: 'k1', totalCents: 0, appointment: { purpose: 'event' } }),
    ).toBe(false);
    expect(isTrialSettledAtEvent({ contractId: 'k1', totalCents: 0, appointment: null })).toBe(false);
  });
});

describe('splitTrialCommission (261124-ijh)', () => {
  it('R$ 400 vira R$ 200 no teste + R$ 200 no dia', () => {
    expect(splitTrialCommission(40000, 'trial')).toBe(20000);
    expect(splitTrialCommission(40000, 'event')).toBe(20000);
  });
  it('centavo ímpar fica no dia e a soma bate com a regra', () => {
    expect(splitTrialCommission(4001, 'trial')).toBe(2000);
    expect(splitTrialCommission(4001, 'event')).toBe(2001);
  });
  it('regra zero -> zero nos dois', () => {
    expect(splitTrialCommission(0, 'trial')).toBe(0);
    expect(splitTrialCommission(0, 'event')).toBe(0);
  });
});
