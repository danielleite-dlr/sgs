import { isDealOverdue, overdueSince } from './commercial-sla';

const NOW = new Date('2026-11-18T12:00:00Z');
const base = {
  status: 'open' as 'open' | 'won' | 'lost',
  slaDays: 2 as number | null,
  lastInteractionAt: new Date('2026-11-16T11:59:59Z') as Date | null,
  stageEnteredAt: new Date('2026-11-10T00:00:00Z'),
};

describe('isDealOverdue', () => {
  it('etapa sem prazo nunca atrasa', () => {
    expect(isDealOverdue({ ...base, slaDays: null }, NOW)).toBe(false);
  });
  it('negócio ganho ou perdido não atrasa', () => {
    expect(isDealOverdue({ ...base, status: 'won' }, NOW)).toBe(false);
    expect(isDealOverdue({ ...base, status: 'lost' }, NOW)).toBe(false);
  });
  it('passou do prazo por 1 segundo atrasa', () => {
    expect(isDealOverdue(base, NOW)).toBe(true);
  });
  it('1 segundo dentro do prazo não atrasa', () => {
    expect(
      isDealOverdue({ ...base, lastInteractionAt: new Date('2026-11-16T12:00:01Z') }, NOW),
    ).toBe(false);
  });
  it('exatamente no limite não atrasa', () => {
    expect(
      isDealOverdue({ ...base, lastInteractionAt: new Date('2026-11-16T12:00:00Z') }, NOW),
    ).toBe(false);
  });
  it('sem interação usa a entrada na etapa', () => {
    expect(isDealOverdue({ ...base, lastInteractionAt: null }, NOW)).toBe(true);
    expect(
      isDealOverdue(
        { ...base, lastInteractionAt: null, stageEnteredAt: new Date('2026-11-17T12:00:00Z') },
        NOW,
      ),
    ).toBe(false);
  });
});

describe('overdueSince', () => {
  it('devolve base + slaDays dias', () => {
    expect(overdueSince(base)?.toISOString()).toBe('2026-11-18T11:59:59.000Z');
  });
  it('usa stageEnteredAt sem interação', () => {
    expect(overdueSince({ ...base, lastInteractionAt: null })?.toISOString()).toBe(
      '2026-11-12T00:00:00.000Z',
    );
  });
  it('null sem prazo ou fora de aberto', () => {
    expect(overdueSince({ ...base, slaDays: null })).toBeNull();
    expect(overdueSince({ ...base, status: 'won' })).toBeNull();
  });
});
