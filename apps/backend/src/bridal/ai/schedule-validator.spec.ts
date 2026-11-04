import type { Proposal, ProposalItem, ScheduleContext } from './ai-schedule.schema';
import { validateProposal } from './schedule-validator';

/** Horário local (-03) de 2026-12-20 -> ISO UTC. */
const at = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 11, 20, h + 3, m)).toISOString();
};

function buildFixtureContext(): ScheduleContext {
  const companion = (ref: string) => ({
    ref,
    role: 'companion' as const,
    services: [
      {
        serviceId: 'makeup',
        label: 'Maquiagem',
        durationMinutes: 45,
        eligibleProfessionalIds: ['m1'],
      },
    ],
  });
  return {
    eventDate: '2026-12-20',
    readyBy: at('15:00'),
    dayStart: at('06:00'),
    dayEnd: at('20:00'),
    travelBeforeMinutes: 0,
    travelAfterMinutes: 0,
    persons: [
      {
        ref: 'p1',
        role: 'bride',
        services: [
          {
            serviceId: 'makeup',
            label: 'Maquiagem',
            durationMinutes: 60,
            eligibleProfessionalIds: ['m1'],
          },
          {
            serviceId: 'hair',
            label: 'Penteado',
            durationMinutes: 60,
            eligibleProfessionalIds: ['h1'],
          },
        ],
      },
      companion('p2'),
      companion('p3'),
      companion('p4'),
      companion('p5'),
    ],
    professionals: [
      { id: 'm1', label: 'Maquiadora' },
      { id: 'h1', label: 'Cabeleireira' },
    ],
    busy: [],
  };
}

const item = (
  personRef: string,
  serviceId: string,
  professionalId: string,
  s: string,
  e: string,
): ProposalItem => ({
  personRef,
  serviceId,
  professionalId,
  startsAt: at(s),
  endsAt: at(e),
});

/** Proposta correta: acompanhantes na maquiagem cedo, noiva por último até 15:00. */
function validItems(): ProposalItem[] {
  return [
    item('p5', 'makeup', 'm1', '10:00', '10:45'),
    item('p4', 'makeup', 'm1', '10:45', '11:30'),
    item('p3', 'makeup', 'm1', '11:30', '12:15'),
    item('p2', 'makeup', 'm1', '12:15', '13:00'),
    item('p1', 'makeup', 'm1', '13:00', '14:00'),
    item('p1', 'hair', 'h1', '14:00', '15:00'),
  ];
}

const codes = (p: Proposal, ctx: ScheduleContext) =>
  validateProposal(p, ctx).violations.map((v) => v.code);

describe('validateProposal', () => {
  const ctx = buildFixtureContext();

  it('proposta correta é ok, sem violações nem avisos', () => {
    const r = validateProposal({ items: validItems() }, ctx);
    expect(r).toEqual({ ok: true, violations: [], warnings: [] });
  });

  // [descrição, mutação sobre a proposta/ctx, código esperado]
  const table: [string, (items: ProposalItem[], c: ScheduleContext) => void, string][] = [
    [
      'pessoa desconhecida',
      (i) => {
        i.push(item('p9', 'makeup', 'm1', '08:00', '08:45'));
      },
      'UNKNOWN_PERSON',
    ],
    [
      'serviço desconhecido para a pessoa',
      (i) => {
        i.push(item('p2', 'nails', 'm1', '08:00', '08:45'));
      },
      'UNKNOWN_SERVICE',
    ],
    [
      'serviço faltando',
      (i) => {
        i.splice(5, 1);
      },
      'MISSING_SERVICE',
    ],
    [
      'serviço duplicado',
      (i) => {
        i.push(item('p2', 'makeup', 'm1', '08:00', '08:45'));
      },
      'DUPLICATE_SERVICE',
    ],
    [
      'profissional desconhecido',
      (i) => {
        i[0].professionalId = 'zz';
      },
      'UNKNOWN_PROFESSIONAL',
    ],
    [
      'profissional não habilitado',
      (i) => {
        i[0].professionalId = 'h1';
      },
      'PROFESSIONAL_NOT_ELIGIBLE',
    ],
    [
      'horário inválido (data ilegível)',
      (i) => {
        i[0].startsAt = 'amanhã';
      },
      'INVALID_TIME',
    ],
    [
      'horário inválido (fim antes do início)',
      (i) => {
        i[0].endsAt = at('09:00');
      },
      'INVALID_TIME',
    ],
    [
      'duração errada',
      (i) => {
        i[0].endsAt = at('10:30');
      },
      'WRONG_DURATION',
    ],
    [
      'fora da janela do dia',
      (i) => {
        i[0].startsAt = at('05:15');
        i[0].endsAt = at('06:00');
      },
      'OUTSIDE_DAY_WINDOW',
    ],
    [
      'depois do "pronta até"',
      (i) => {
        i[0].startsAt = at('15:00');
        i[0].endsAt = at('15:45');
      },
      'AFTER_READY_BY',
    ],
    [
      'sobreposição do profissional',
      (i) => {
        i[0].startsAt = at('10:30');
        i[0].endsAt = at('11:15');
      },
      'PROFESSIONAL_OVERLAP',
    ],
    [
      'conflito com ocupação',
      (_i, c) => {
        c.busy.push({
          professionalId: 'm1',
          startsAt: at('10:15'),
          endsAt: at('10:30'),
        });
      },
      'BUSY_CONFLICT',
    ],
    [
      'mesma pessoa em dois serviços ao mesmo tempo',
      (i) => {
        // penteado da noiva vai para 13:30-14:30 (h1 livre), sobrepondo a maquiagem 13:00-14:00
        i[5].startsAt = at('13:30');
        i[5].endsAt = at('14:30');
      },
      'PERSON_OVERLAP',
    ],
    [
      'conflito de deslocamento na ida',
      (_i, c) => {
        c.travelBeforeMinutes = 30;
        c.busy.push({
          professionalId: 'm1',
          startsAt: at('09:30'),
          endsAt: at('09:45'),
        });
      },
      'TRAVEL_CONFLICT',
    ],
    [
      'conflito de deslocamento na volta',
      (_i, c) => {
        c.travelAfterMinutes = 30;
        c.busy.push({
          professionalId: 'h1',
          startsAt: at('15:00'),
          endsAt: at('15:15'),
        });
      },
      'TRAVEL_CONFLICT',
    ],
  ];

  it.each(table)('%s -> %s', (_name, mutate, code) => {
    const c = structuredClone(ctx);
    const items = validItems();
    mutate(items, c);
    expect(codes({ items }, c)).toContain(code);
    expect(validateProposal({ items }, c).ok).toBe(false);
  });

  it('cobre os 14 códigos de violação', () => {
    const produced = new Set(table.map((t) => t[2]));
    expect([...produced].sort()).toEqual(
      [
        'UNKNOWN_PERSON',
        'UNKNOWN_SERVICE',
        'MISSING_SERVICE',
        'DUPLICATE_SERVICE',
        'UNKNOWN_PROFESSIONAL',
        'PROFESSIONAL_NOT_ELIGIBLE',
        'INVALID_TIME',
        'WRONG_DURATION',
        'OUTSIDE_DAY_WINDOW',
        'AFTER_READY_BY',
        'PROFESSIONAL_OVERLAP',
        'BUSY_CONFLICT',
        'PERSON_OVERLAP',
        'TRAVEL_CONFLICT',
      ].sort(),
    );
  });

  it('violação carrega personRef/serviceId/professionalId do item', () => {
    const items = validItems();
    items[0].endsAt = at('10:30');
    const v = validateProposal({ items }, ctx).violations[0];
    expect(v).toMatchObject({
      code: 'WRONG_DURATION',
      personRef: 'p5',
      serviceId: 'makeup',
      professionalId: 'm1',
    });
    expect(typeof v.message).toBe('string');
  });

  it('aviso BRIDE_NOT_LAST quando acompanhante termina depois da noiva (sem bloquear)', () => {
    const items: ProposalItem[] = [
      item('p1', 'makeup', 'm1', '10:00', '11:00'),
      item('p1', 'hair', 'h1', '11:00', '12:00'),
      item('p2', 'makeup', 'm1', '13:00', '13:45'),
      item('p3', 'makeup', 'm1', '13:45', '14:30'),
      item('p4', 'makeup', 'm1', '11:00', '11:45'),
      item('p5', 'makeup', 'm1', '12:00', '12:45'),
    ];
    const r = validateProposal({ items }, ctx);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['BRIDE_NOT_LAST']);
  });
});
