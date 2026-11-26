import type { ScheduleContext } from './ai-schedule.schema';
import { buildHeuristicProposal } from './heuristic-scheduler';
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
    companionReadyBy: at('15:00'),
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
      {
        id: 'm1',
        label: 'Maquiadora',
        isFixed: false,
        dayMinutes: 0,
        rotationRank: 0,
      },
      {
        id: 'h1',
        label: 'Cabeleireira',
        isFixed: false,
        dayMinutes: 0,
        rotationRank: 1,
      },
    ],
    busy: [],
  };
}

describe('buildHeuristicProposal', () => {
  it('noiva + 4 acompanhantes: tudo agendado, válido e noiva termina até "pronta até"', () => {
    const ctx = buildFixtureContext();
    const { proposal, unscheduled } = buildHeuristicProposal(ctx);
    expect(unscheduled).toEqual([]);
    expect(proposal.items).toHaveLength(6);
    const v = validateProposal(proposal, ctx);
    expect(v.violations).toEqual([]);
    expect(v.ok).toBe(true);
    const brideEnds = proposal.items
      .filter((i) => i.personRef === 'p1')
      .map((i) => Date.parse(i.endsAt));
    expect(Math.max(...brideEnds)).toBe(Date.parse(ctx.readyBy));
  });

  it('é determinística: duas execuções dão saídas idênticas', () => {
    const a = buildHeuristicProposal(buildFixtureContext());
    const b = buildHeuristicProposal(buildFixtureContext());
    expect(a).toEqual(b);
  });

  it('itens saem ordenados por início e depois por profissional', () => {
    const { proposal } = buildHeuristicProposal(buildFixtureContext());
    const keys = proposal.items.map((i) => `${i.startsAt}|${i.professionalId}`);
    expect(keys).toEqual([...keys].sort());
  });

  it('com m1 ocupado o dia todo e m2 elegível, usa m2', () => {
    const ctx = buildFixtureContext();
    ctx.professionals.push({
      id: 'm2',
      label: 'Maquiadora 2',
      isFixed: false,
      dayMinutes: 0,
      rotationRank: 2,
    });
    for (const p of ctx.persons) {
      for (const s of p.services) {
        if (s.eligibleProfessionalIds.includes('m1')) s.eligibleProfessionalIds.push('m2');
      }
    }
    ctx.busy.push({
      professionalId: 'm1',
      startsAt: ctx.dayStart,
      endsAt: ctx.dayEnd,
    });
    const { proposal, unscheduled } = buildHeuristicProposal(ctx);
    expect(unscheduled).toEqual([]);
    expect(proposal.items.some((i) => i.professionalId === 'm1')).toBe(false);
    expect(proposal.items.filter((i) => i.professionalId === 'm2')).toHaveLength(5);
    expect(validateProposal(proposal, ctx).ok).toBe(true);
  });

  it('sem profissional livre para um serviço: vai para unscheduled e o resto é agendado', () => {
    const ctx = buildFixtureContext();
    // m1 ocupado o dia todo e único habilitado em maquiagem: só o penteado da noiva sobra
    ctx.busy.push({
      professionalId: 'm1',
      startsAt: ctx.dayStart,
      endsAt: ctx.dayEnd,
    });
    const { proposal, unscheduled } = buildHeuristicProposal(ctx);
    expect(unscheduled).toHaveLength(5);
    expect(unscheduled).toContainEqual({
      personRef: 'p1',
      serviceId: 'makeup',
      reason: 'NO_FREE_PROFESSIONAL_BEFORE_LIMIT',
    });
    expect(unscheduled).toContainEqual({
      personRef: 'p5',
      serviceId: 'makeup',
      reason: 'NO_FREE_PROFESSIONAL_BEFORE_LIMIT',
    });
    expect(proposal.items).toEqual([
      expect.objectContaining({
        personRef: 'p1',
        serviceId: 'hair',
        professionalId: 'h1',
      }),
    ]);
  });

  it('com deslocamento 30/30 o resultado continua válido', () => {
    const ctx = buildFixtureContext();
    ctx.travelBeforeMinutes = 30;
    ctx.travelAfterMinutes = 30;
    ctx.busy.push({
      professionalId: 'm1',
      startsAt: at('14:00'),
      endsAt: at('14:30'),
    });
    const { proposal, unscheduled } = buildHeuristicProposal(ctx);
    expect(unscheduled).toEqual([]);
    const v = validateProposal(proposal, ctx);
    expect(v.violations).toEqual([]);
    // nada encosta na ocupação nem no acolchoado de 30 min ao redor
    for (const i of proposal.items.filter((x) => x.professionalId === 'm1')) {
      const s = Date.parse(i.startsAt) - 30 * 60_000;
      const e = Date.parse(i.endsAt) + 30 * 60_000;
      expect(s < Date.parse(at('14:30')) && Date.parse(at('14:00')) < e).toBe(false);
    }
  });

  it('contexto grande demais lança RangeError(CONTEXT_TOO_LARGE)', () => {
    const ctx = buildFixtureContext();
    ctx.persons = Array.from({ length: 13 }, (_, k) => ({
      ...ctx.persons[1],
      ref: `p${k + 1}`,
    }));
    expect(() => buildHeuristicProposal(ctx)).toThrow(RangeError);
    expect(() => buildHeuristicProposal(ctx)).toThrow('CONTEXT_TOO_LARGE');
  });

  describe('prioridade (fase 11)', () => {
    const pro = (id: string, isFixed: boolean, dayMinutes = 0, rotationRank = 0) => ({
      id,
      label: id,
      isFixed,
      dayMinutes,
      rotationRank,
    });
    const makeCtx = (
      pros: ReturnType<typeof pro>[],
      companions: number,
      eligible: string[],
    ): ScheduleContext => ({
      eventDate: '2026-12-20',
      readyBy: at('10:00'),
      companionReadyBy: at('10:00'),
      dayStart: at('06:00'),
      dayEnd: at('20:00'),
      travelBeforeMinutes: 0,
      travelAfterMinutes: 0,
      persons: Array.from({ length: companions }, (_, k) => ({
        ref: `p${k + 1}`,
        role: 'companion' as const,
        services: [
          {
            serviceId: 'make',
            label: 'Make',
            durationMinutes: 60,
            eligibleProfessionalIds: eligible,
          },
        ],
      })),
      professionals: pros,
      busy: [],
    });

    it('fixa que cabe antes do limite vence não fixa mais tarde e devolve earlyByPriority (D-18)', () => {
      const ctx = makeCtx([pro('A', false), pro('B', true)], 1, ['A', 'B']);
      ctx.busy.push({
        professionalId: 'B',
        startsAt: at('09:00'),
        endsAt: at('10:00'),
      });
      const r = buildHeuristicProposal(ctx);
      expect(r.proposal.items).toEqual([
        expect.objectContaining({
          professionalId: 'B',
          startsAt: at('08:00'),
          endsAt: at('09:00'),
        }),
      ]);
      expect(r.earlyByPriority).toEqual([
        { personRef: 'p1', serviceId: 'make', minutesBeforeLimit: 60 },
      ]);
    });

    it('duas fixas livres: cada acompanhante pega uma (divisão D-10)', () => {
      const ctx = makeCtx([pro('A', true), pro('B', true)], 2, ['A', 'B']);
      const r = buildHeuristicProposal(ctx);
      expect(new Set(r.proposal.items.map((i) => i.professionalId))).toEqual(new Set(['A', 'B']));
      expect(r.earlyByPriority).toEqual([]);
    });

    it('mesmos minutos: revezamento decide (D-11)', () => {
      const ctx = makeCtx([pro('A', true, 0, 1), pro('B', true, 0, 0)], 1, ['A', 'B']);
      const r = buildHeuristicProposal(ctx);
      expect(r.proposal.items[0].professionalId).toBe('B');
    });

    it('sem elegíveis: NO_ELIGIBLE_PROFESSIONAL', () => {
      const ctx = makeCtx([pro('A', true)], 1, []);
      expect(buildHeuristicProposal(ctx).unscheduled).toEqual([
        {
          personRef: 'p1',
          serviceId: 'make',
          reason: 'NO_ELIGIBLE_PROFESSIONAL',
        },
      ]);
    });

    it('acompanhante com limite no início do dia: NO_FREE_PROFESSIONAL_BEFORE_LIMIT', () => {
      const ctx = makeCtx([pro('A', true)], 1, ['A']);
      ctx.companionReadyBy = ctx.dayStart;
      expect(buildHeuristicProposal(ctx).unscheduled).toEqual([
        {
          personRef: 'p1',
          serviceId: 'make',
          reason: 'NO_FREE_PROFESSIONAL_BEFORE_LIMIT',
        },
      ]);
    });

    it('acompanhante usa companionReadyBy e noiva usa readyBy', () => {
      const ctx = makeCtx([pro('A', true), pro('B', true)], 1, ['A']);
      ctx.companionReadyBy = at('09:00');
      ctx.persons.unshift({
        ref: 'pb',
        role: 'bride',
        services: [
          {
            serviceId: 'bm',
            label: 'Make noiva',
            durationMinutes: 60,
            eligibleProfessionalIds: ['B'],
          },
        ],
      });
      const r = buildHeuristicProposal(ctx);
      const byRef = (ref: string) => r.proposal.items.find((i) => i.personRef === ref)!;
      expect(byRef('p1').endsAt).toBe(at('09:00'));
      expect(byRef('pb').endsAt).toBe(at('10:00'));
    });

    it('mesma entrada e arrays em outra ordem dão a mesma proposta', () => {
      const a = makeCtx([pro('A', true, 0, 0), pro('B', true, 0, 1)], 2, ['A', 'B']);
      const b = makeCtx([pro('B', true, 0, 1), pro('A', true, 0, 0)], 2, ['B', 'A']);
      expect(buildHeuristicProposal(a).proposal).toEqual(buildHeuristicProposal(b).proposal);
      expect(buildHeuristicProposal(a)).toEqual(buildHeuristicProposal(a));
    });
  });
});
