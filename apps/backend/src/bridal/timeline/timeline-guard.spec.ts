import {
  canOverrideTimeline,
  evaluateCompanionRules,
  type ConfirmedTimelineLite,
} from './timeline-guard';

const TZ = 'America/Sao_Paulo';
// 08/11/2026, America/Sao_Paulo = UTC-3
const at = (hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 10, 8, h + 3, m));
};

const PRO_A = 'pro-a';
const PRO_B = 'pro-b';
const PRO_C = 'pro-c';

const timeline: ConfirmedTimelineLite = {
  id: 't1',
  groupId: 'g1',
  brideLabel: 'VITORIA',
  registryStartsAt: at('15:30'),
  registryLabel: 'fotos',
  windows: [
    { kind: 'make', professionalId: PRO_A, startsAt: at('12:30'), endsAt: at('14:00') },
    { kind: 'hair', professionalId: PRO_B, startsAt: at('14:00'), endsAt: at('15:30') },
  ],
};

const slot = (professionalId: string, from: string, to: string) => ({
  professionalId,
  startsAt: at(from),
  endsAt: at(to),
});

describe('evaluateCompanionRules', () => {
  it('permite terminar exatamente no início do registro', () => {
    expect(evaluateCompanionRules(timeline, slot(PRO_C, '14:30', '15:30'), TZ)).toBeNull();
  });

  it('bloqueia quem termina depois do início do registro', () => {
    const r = evaluateCompanionRules(timeline, slot(PRO_C, '14:45', '15:45'), TZ);
    expect(r?.rule).toBe('TIMELINE_AFTER_REGISTRY');
    expect(r?.message).toBe(
      'Esta acompanhante precisa terminar até 15:30, quando começa "fotos" da noiva VITORIA.',
    );
  });

  it('bloqueia o uso da profissional do make dentro da janela da noiva', () => {
    const r = evaluateCompanionRules(timeline, slot(PRO_A, '13:00', '13:30'), TZ);
    expect(r?.rule).toBe('TIMELINE_PROFESSIONAL_WITH_BRIDE');
    expect(r?.message).toBe('Esta profissional está com a noiva VITORIA das 12:30 às 14h (make).');
  });

  it('permite encostar na janela sem cruzar', () => {
    expect(evaluateCompanionRules(timeline, slot(PRO_A, '11:30', '12:30'), TZ)).toBeNull();
  });

  it('identifica a janela do penteado', () => {
    const r = evaluateCompanionRules(timeline, slot(PRO_B, '13:30', '14:15'), TZ);
    expect(r?.rule).toBe('TIMELINE_PROFESSIONAL_WITH_BRIDE');
    expect(r?.message).toContain('(penteado)');
  });

  it('dá prioridade à regra do registro', () => {
    const r = evaluateCompanionRules(timeline, slot(PRO_A, '14:00', '16:00'), TZ);
    expect(r?.rule).toBe('TIMELINE_AFTER_REGISTRY');
  });

  it('ignora janela sem profissional definida', () => {
    const t: ConfirmedTimelineLite = {
      ...timeline,
      windows: [{ kind: 'make', professionalId: null, startsAt: at('12:30'), endsAt: at('14:00') }],
    };
    expect(evaluateCompanionRules(t, slot(PRO_A, '13:00', '13:30'), TZ)).toBeNull();
    expect(evaluateCompanionRules(t, slot(PRO_A, '15:00', '16:00'), TZ)?.rule).toBe(
      'TIMELINE_AFTER_REGISTRY',
    );
  });
});

describe('canOverrideTimeline', () => {
  it('libera Administrador e Gerente', () => {
    expect(canOverrideTimeline('ADMIN')).toBe(true);
    expect(canOverrideTimeline('MANAGER')).toBe(true);
  });

  it('nega Atendente, Profissional e papel ausente', () => {
    expect(canOverrideTimeline('ATTENDANT')).toBe(false);
    expect(canOverrideTimeline('PROFESSIONAL')).toBe(false);
    expect(canOverrideTimeline(null)).toBe(false);
    expect(canOverrideTimeline(undefined)).toBe(false);
  });
});
