import {
  brideWindows,
  computeTimeline,
  defaultBrideLabel,
  formatDdMm,
  formatHour,
  parseDepartureTime,
  TimelineDomainError,
  type TimelineInput,
  type TimelineResult,
  type TimelineRuleStep,
} from './timeline-domain';

let order = 0;
const step = (
  name: string,
  offsetMinutes: number,
  extras: Partial<TimelineRuleStep> = {},
): TimelineRuleStep => ({
  name,
  offsetMinutes,
  isExtra: false,
  kind: null,
  startsRegistry: false,
  displayOrder: order++,
  durationMinutes: null,
  serviceId: null,
  ...extras,
});
const make = (offset: number) =>
  step('make', offset, { kind: 'make', durationMinutes: 90, serviceId: 'svc-make' });
const hair = (offset: number) =>
  step('penteado', offset, { kind: 'hair', durationMinutes: 90, serviceId: 'svc-hair' });
const photographers = (offset: number) =>
  step('Chegada fotógrafos', offset, { isExtra: true });

const EXPERIENCE: TimelineRuleStep[] = [
  step('chegada - coffee', 420),
  step('massagem', 360),
  step('banheira', 300),
  make(240),
  hair(150),
  step('making of', 60, { startsRegistry: true }),
  step('saída', 0),
  photographers(80),
];
const GLAM: TimelineRuleStep[] = [
  step('chegada - coffee', 450),
  step('massagem', 390),
  step('banheira', 330),
  make(270),
  hair(180),
  step('fotos', 90, { startsRegistry: true }),
  step('saída', 0),
  photographers(110),
];
const ELEGANCE: TimelineRuleStep[] = [
  step('chegada - coffee', 360),
  step('lavar cabelo', 300),
  make(270),
  hair(180),
  step('fotos', 90, { startsRegistry: true }),
  step('saída', 0),
  photographers(110),
];

const base = (over: Partial<TimelineInput>): TimelineInput => ({
  packageName: 'Glam',
  brideLabel: 'Vitoria',
  eventDateDdMm: '08/11',
  departureMinutes: 1020,
  steps: GLAM,
  makeProfessionalName: 'Camila',
  hairProfessionalName: 'Sarah',
  ...over,
});

const mins = (r: TimelineResult, isExtra = false) =>
  r.rows.filter((x) => x.isExtra === isExtra).map((x) => x.minutes);
const hours = (r: TimelineResult) =>
  r.rows.filter((x) => !x.isExtra).map((x) => x.time);

/** Executa fn, exige TimelineDomainError e devolve code + message. */
function failure(fn: () => unknown): { code: string; message: string } | null {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(TimelineDomainError);
    const err = e as TimelineDomainError;
    return { code: err.code, message: err.message };
  }
  return null;
}

describe('timeline-domain', () => {
  it('1. Experience saída 15h', () => {
    const r = computeTimeline(
      base({ packageName: 'Experience', steps: EXPERIENCE, departureMinutes: 900 }),
    );
    expect(mins(r)).toEqual([480, 540, 600, 660, 750, 840, 900]);
    expect(hours(r)).toEqual(['08h', '09h', '10h', '11h', '12:30', '14h', '15h']);
    expect(mins(r, true)).toEqual([820]);
    expect(r.rows.find((x) => x.isExtra)?.time).toBe('13:40');
    expect(r.registryStartMinutes).toBe(840);
    expect(r.registryName).toBe('making of');
  });

  it('2. Glam saída 15:30', () => {
    const r = computeTimeline(base({ departureMinutes: 930 }));
    expect(mins(r)).toEqual([480, 540, 600, 660, 750, 840, 930]);
    const t = (n: string) => r.rows.find((x) => x.name === n)?.time;
    expect(t('make')).toBe('11h');
    expect(t('penteado')).toBe('12:30');
    expect(t('fotos')).toBe('14h');
    expect(t('Chegada fotógrafos')).toBe('13:40');
    expect(r.registryStartMinutes).toBe(840);
  });

  it('3. Elegance saída 17:30', () => {
    const r = computeTimeline(
      base({ packageName: 'Elegance', steps: ELEGANCE, departureMinutes: 1050 }),
    );
    expect(mins(r)).toEqual([690, 750, 780, 870, 960, 1050]);
    expect(hours(r)).toEqual(['11:30', '12:30', '13h', '14:30', '16h', '17:30']);
    expect(mins(r, true)).toEqual([940]);
    expect(r.rows.find((x) => x.isExtra)?.time).toBe('15:40');
  });

  it('4. Glam 17h gera o texto exato da referência', () => {
    // a referência original dizia 15:20; D-06 de 2026-11-14 decidiu que vale a regra:
    // fotos 15:30 - 20 min = 15:10
    const r = computeTimeline(base({}));
    expect(r.text).toBe(
      [
        'CRONOGRAMA NOIVA VITORIA - 08/11 - Pacote Glam',
        '',
        '09:30 chegada - coffee',
        '10:30 massagem',
        '11:30 banheira',
        '12:30 make - profissional Camila',
        '14h penteado - profissional Sarah',
        '15:30 fotos',
        '17h saída',
        '',
        'Chegada fotógrafos: 15:10',
      ].join('\n'),
    );
    expect(r.warnings).toEqual([]);
    expect(brideWindows(r)).toEqual([
      { kind: 'make', serviceId: 'svc-make', startMinutes: 750, endMinutes: 840 },
      { kind: 'hair', serviceId: 'svc-hair', startMinutes: 840, endMinutes: 930 },
    ]);
  });

  it('5. formatHour', () => {
    expect(formatHour(0)).toBe('00h');
    expect(formatHour(480)).toBe('08h');
    expect(formatHour(545)).toBe('09:05');
    expect(formatHour(570)).toBe('09:30');
    expect(formatHour(720)).toBe('12h');
    expect(formatHour(1020)).toBe('17h');
    expect(formatHour(1439)).toBe('23:59');
  });

  it('6. parseDepartureTime', () => {
    expect(parseDepartureTime('17:00')).toBe(1020);
    expect(parseDepartureTime('09:30')).toBe(570);
    expect(parseDepartureTime('00:00')).toBe(0);
    for (const bad of ['7:00', '24:00', '17h', '', '17:60']) {
      expect(failure(() => parseDepartureTime(bad))?.code).toBe('INVALID_DEPARTURE');
    }
  });

  it('7. formatDdMm e defaultBrideLabel', () => {
    expect(formatDdMm('2026-11-08')).toBe('08/11');
    expect(defaultBrideLabel('Vitória Souza')).toBe('VITÓRIA');
    expect(defaultBrideLabel('  ana   maria ')).toBe('ANA');
    expect(defaultBrideLabel('')).toBe('');
  });

  it('8. título sempre em maiúsculas', () => {
    const r = computeTimeline(base({ brideLabel: 'vitória' }));
    expect(r.text.startsWith('CRONOGRAMA NOIVA VITÓRIA - ')).toBe(true);
  });

  it('9. sem profissionais gera [a definir] e avisos', () => {
    const r = computeTimeline(
      base({ makeProfessionalName: null, hairProfessionalName: '   ' }),
    );
    expect(r.text).toContain('12:30 make - profissional [a definir]');
    expect(r.text).toContain('14h penteado - profissional [a definir]');
    expect(r.warnings).toEqual([
      { code: 'PROFESSIONAL_UNDEFINED', message: 'Falta definir a profissional de make.' },
      {
        code: 'PROFESSIONAL_UNDEFINED',
        message: 'Falta definir a profissional de penteado.',
      },
    ]);
  });

  it('10. chegada antes das 06h gera aviso e mantém o texto', () => {
    const r = computeTimeline(base({ departureMinutes: 780 }));
    expect(r.warnings).toContainEqual({
      code: 'ARRIVAL_BEFORE_06',
      message:
        'A chegada calculada (05:30) é antes das 06h. Confira a saída e o pacote antes de enviar.',
    });
    expect(r.text.length).toBeGreaterThan(0);
  });

  it('11. antes da meia-noite lança BEFORE_MIDNIGHT', () => {
    expect(failure(() => computeTimeline(base({ departureMinutes: 420 })))).toEqual({
      code: 'BEFORE_MIDNIGHT',
      message: 'O cronograma começaria no dia anterior. Confira a saída.',
    });
  });

  it('12. sem etapas lança TIMELINE_RULES_MISSING', () => {
    const expected = {
      code: 'TIMELINE_RULES_MISSING',
      message:
        'Este pacote não tem cronograma configurado. Escolha outro pacote ou configure as etapas no catálogo.',
    };
    expect(failure(() => computeTimeline(base({ steps: [] })))).toEqual(expected);
    expect(failure(() => computeTimeline(base({ steps: [photographers(110)] })))).toEqual(
      expected,
    );
  });

  it('13. sem etapa de registro gera NO_REGISTRY_STEP', () => {
    const steps = GLAM.map((s) => ({ ...s, startsRegistry: false }));
    const r = computeTimeline(base({ steps }));
    expect(r.registryStartMinutes).toBeNull();
    expect(r.registryName).toBeNull();
    expect(r.warnings).toContainEqual({
      code: 'NO_REGISTRY_STEP',
      message: 'O pacote não tem etapa marcada como início do registro (fotos/making of).',
    });
  });

  it('14. etapa kind sem serviceId gera SERVICE_UNDEFINED', () => {
    const steps = GLAM.map((s) => (s.kind ? { ...s, serviceId: null } : s));
    const r = computeTimeline(base({ steps }));
    expect(r.warnings).toContainEqual({
      code: 'SERVICE_UNDEFINED',
      message: 'A etapa de make não está ligada a um serviço do pacote.',
    });
    expect(r.warnings).toContainEqual({
      code: 'SERVICE_UNDEFINED',
      message: 'A etapa de penteado não está ligada a um serviço do pacote.',
    });
  });

  it('15. ordem por offset decrescente, desempate por displayOrder, sem extras sem linha em branco', () => {
    const r = computeTimeline(base({ steps: [...GLAM].reverse() }));
    expect(mins(r)).toEqual([570, 630, 690, 750, 840, 930, 1020]);
    expect(mins(r, true)).toEqual([910]);
    expect(r.rows[r.rows.length - 1].isExtra).toBe(true);

    const noExtras = computeTimeline(base({ steps: GLAM.filter((s) => !s.isExtra) }));
    expect(noExtras.text.endsWith('17h saída')).toBe(true);
    expect(noExtras.text).not.toContain('Chegada fotógrafos');

    const tied = computeTimeline(
      base({
        steps: [
          step('b', 60, { displayOrder: 2 }),
          step('a', 60, { displayOrder: 1 }),
          step('saída', 0),
        ],
      }),
    );
    expect(tied.rows.map((x) => x.name)).toEqual(['a', 'b', 'saída']);
  });
});
