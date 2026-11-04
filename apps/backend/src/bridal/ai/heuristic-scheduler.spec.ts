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
    ctx.professionals.push({ id: 'm2', label: 'Maquiadora 2' });
    for (const p of ctx.persons) {
      for (const s of p.services) {
        if (s.eligibleProfessionalIds.includes('m1')) s.eligibleProfessionalIds.push('m2');
      }
    }
    ctx.busy.push({ professionalId: 'm1', startsAt: ctx.dayStart, endsAt: ctx.dayEnd });
    const { proposal, unscheduled } = buildHeuristicProposal(ctx);
    expect(unscheduled).toEqual([]);
    expect(proposal.items.some((i) => i.professionalId === 'm1')).toBe(false);
    expect(proposal.items.filter((i) => i.professionalId === 'm2')).toHaveLength(5);
    expect(validateProposal(proposal, ctx).ok).toBe(true);
  });

  it('sem profissional livre para um serviço: vai para unscheduled e o resto é agendado', () => {
    const ctx = buildFixtureContext();
    // m1 ocupado o dia todo e único habilitado em maquiagem: só o penteado da noiva sobra
    ctx.busy.push({ professionalId: 'm1', startsAt: ctx.dayStart, endsAt: ctx.dayEnd });
    const { proposal, unscheduled } = buildHeuristicProposal(ctx);
    expect(unscheduled).toHaveLength(5);
    expect(unscheduled).toContainEqual({ personRef: 'p1', serviceId: 'makeup' });
    expect(unscheduled).toContainEqual({ personRef: 'p5', serviceId: 'makeup' });
    expect(proposal.items).toEqual([
      expect.objectContaining({ personRef: 'p1', serviceId: 'hair', professionalId: 'h1' }),
    ]);
  });

  it('com deslocamento 30/30 o resultado continua válido', () => {
    const ctx = buildFixtureContext();
    ctx.travelBeforeMinutes = 30;
    ctx.travelAfterMinutes = 30;
    ctx.busy.push({ professionalId: 'm1', startsAt: at('14:00'), endsAt: at('14:30') });
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
});
