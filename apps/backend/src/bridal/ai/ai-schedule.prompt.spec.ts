import { buildPromptInput, canonicalHash } from './ai-schedule.prompt';
import type { ScheduleContext } from './ai-schedule.schema';

const ctx = (): ScheduleContext => ({
  eventDate: '2030-06-15',
  readyBy: '2030-06-15T18:00:00.000Z',
  dayStart: '2030-06-15T10:00:00.000Z',
  dayEnd: '2030-06-15T22:00:00.000Z',
  travelBeforeMinutes: 0,
  travelAfterMinutes: 0,
  persons: [
    {
      ref: 'p1',
      role: 'bride',
      services: [
        { serviceId: 's1', label: 'Make', durationMinutes: 60, eligibleProfessionalIds: ['a', 'b'] },
        { serviceId: 's2', label: 'Cabelo', durationMinutes: 60, eligibleProfessionalIds: ['a'] },
      ],
    },
    {
      ref: 'p2',
      role: 'companion',
      services: [
        { serviceId: 's1', label: 'Make', durationMinutes: 30, eligibleProfessionalIds: ['b'] },
        { serviceId: 's2', label: 'Cabelo', durationMinutes: 30, eligibleProfessionalIds: ['a'] },
      ],
    },
  ],
  professionals: [
    { id: 'a', label: 'prof_1' },
    { id: 'b', label: 'prof_2' },
  ],
  busy: [
    { professionalId: 'a', startsAt: '2030-06-15T12:00:00.000Z', endsAt: '2030-06-15T13:00:00.000Z' },
    { professionalId: 'b', startsAt: '2030-06-15T14:00:00.000Z', endsAt: '2030-06-15T15:00:00.000Z' },
  ],
});

describe('prompt da agenda IA', () => {
  it('não vaza nomes nem dados pessoais', () => {
    const out = buildPromptInput(ctx());
    expect(out).not.toMatch(/Maria|cpf|phone|fullName/i);
    expect(out).toContain('prof_1');
  });

  it('hash é estável à ordem dos arrays e muda quando busy muda', () => {
    const a = ctx();
    const b = ctx();
    b.persons.reverse();
    b.busy.reverse();
    b.professionals.reverse();
    b.persons[0].services.reverse();
    expect(canonicalHash(a, 'm')).toBe(canonicalHash(b, 'm'));
    const c = ctx();
    c.busy[0].endsAt = '2030-06-15T13:30:00.000Z';
    expect(canonicalHash(c, 'm')).not.toBe(canonicalHash(a, 'm'));
    expect(canonicalHash(a, 'outro')).not.toBe(canonicalHash(a, 'm'));
  });
});
