import {
  COMMERCIAL_SOURCES,
  DEAL_KINDS,
  INTERACTION_TYPES,
  LOST_REASONS,
  isLostReason,
} from './commercial-constants';

describe('listas fixas do Comercial', () => {
  it('motivos de perda espelham o CHECK da migration', () => {
    expect(LOST_REASONS.map((r) => r.code)).toEqual([
      'price',
      'date_unavailable',
      'chose_other',
      'no_response',
      'gave_up',
      'other',
    ]);
    expect(LOST_REASONS[1].label).toBe('Data indisponível');
  });
  it('tipos de interação', () => {
    expect(INTERACTION_TYPES.map((r) => r.code)).toEqual([
      'call',
      'whatsapp',
      'email',
      'meeting',
      'visit',
      'other',
    ]);
  });
  it('tipos de negócio e origens', () => {
    expect(DEAL_KINDS.map((r) => r.code)).toEqual(['noiva', 'debutante']);
    expect(COMMERCIAL_SOURCES.map((r) => r.code)).toEqual([
      'manual',
      'instagram',
      'indicacao',
      'site',
      'whatsapp',
      'import',
      'outro',
    ]);
  });
  it('guard de motivo de perda', () => {
    expect(isLostReason('price')).toBe(true);
    expect(isLostReason('xyz')).toBe(false);
  });
});
