import {
  buildPolicySnapshot,
  CancellationPolicySchema,
  computeCancellationSettlement,
  DEFAULT_CANCELLATION_CLAUSE,
} from './cancellation-policy';

describe('cancellation-policy', () => {
  it('snapshot usa cláusula padrão quando nula', () => {
    expect(buildPolicySnapshot(null)).toEqual({
      version: 1,
      clientCancels: 'retain_all_paid',
      studioCancels: 'refund_all',
      clause: DEFAULT_CANCELLATION_CLAUSE,
    });
  });
  it('snapshot usa cláusula customizada', () => {
    expect(buildPolicySnapshot('  Cláusula personalizada do estúdio. ').clause).toBe(
      'Cláusula personalizada do estúdio.',
    );
  });
  it('rejeita cláusula curta', () => {
    expect(() => buildPolicySnapshot('curta')).toThrow();
    expect(CancellationPolicySchema.safeParse({ version: 2 }).success).toBe(false);
  });
  it.each([
    ['client', 640000, { retainedCents: 640000, refundCents: 0 }],
    ['studio', 640000, { retainedCents: 0, refundCents: 640000 }],
    ['client', 0, { retainedCents: 0, refundCents: 0 }],
  ] as const)('%s com %d pago', (party, paidCents, expected) => {
    expect(computeCancellationSettlement({ party, paidCents })).toEqual(expected);
  });
  it('pago negativo lança RangeError', () => {
    expect(() => computeCancellationSettlement({ party: 'client', paidCents: -1 })).toThrow(RangeError);
  });
  it('não há parâmetro de antecedência (D-22)', () => {
    expect(computeCancellationSettlement.length).toBe(1);
    expect(Object.keys(CancellationPolicySchema.shape).sort()).toEqual([
      'clause',
      'clientCancels',
      'studioCancels',
      'version',
    ]);
  });
});
