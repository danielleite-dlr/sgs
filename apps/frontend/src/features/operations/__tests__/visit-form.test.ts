import { describe, expect, it } from 'vitest';
import { buildCreateVisitInput, expandPackageLines, suggestVariant } from '../lib/visit-form';

const line = {
  serviceId: 's1',
  variantId: null,
  professionalId: 'p1',
  time: '10:00',
  durationMinutes: 60,
};
const base = {
  clientId: 'c1',
  date: '04/11/2026',
  lines: [line],
  packageId: null,
  depositAmount: '50,00',
  depositMethod: 'pix',
};

describe('buildCreateVisitInput', () => {
  it('monta o input com horário local e sinal', () => {
    const r = buildCreateVisitInput(base);
    expect(r).toEqual({
      ok: true,
      input: {
        clientId: 'c1',
        items: [
          {
            serviceId: 's1',
            serviceVariantId: null,
            professionalId: 'p1',
            startsAt: new Date(2026, 10, 4, 10, 0).toISOString(),
            endsAt: new Date(2026, 10, 4, 11, 0).toISOString(),
          },
        ],
        packageId: null,
        deposit: { amount: '50.00', method: 'pix' },
      },
    });
  });
  it('sinal vazio ou zerado vira null', () => {
    for (const depositAmount of ['', '0,00']) {
      const r = buildCreateVisitInput({ ...base, depositAmount });
      expect(r.ok && r.input.deposit).toBeNull();
    }
  });
  it('converte milhar BR', () => {
    const r = buildCreateVisitInput({ ...base, depositAmount: '1.250,50' });
    expect(r.ok && r.input.deposit?.amount).toBe('1250.50');
  });
  it('rejeita data inválida', () => {
    expect(buildCreateVisitInput({ ...base, date: '31/02/2026' })).toEqual({
      ok: false,
      error: 'Data inválida.',
    });
  });
  it('rejeita hora inválida', () => {
    expect(
      buildCreateVisitInput({ ...base, lines: [{ ...line, time: '25:00' }] }),
    ).toEqual({ ok: false, error: 'Hora inválida.' });
  });
  it('exige profissional em cada linha', () => {
    expect(
      buildCreateVisitInput({ ...base, lines: [{ ...line, professionalId: '' }] }),
    ).toEqual({ ok: false, error: 'Escolha o profissional de cada serviço.' });
  });
  it('exige ao menos um serviço', () => {
    expect(buildCreateVisitInput({ ...base, lines: [] })).toEqual({
      ok: false,
      error: 'Inclua ao menos um serviço.',
    });
  });
});

describe('expandPackageLines', () => {
  it('uma linha por serviço distinto, em sequência', () => {
    const lines = expandPackageLines(
      {
        services: [
          { serviceId: 's1', quantity: 1, defaultDurationMinutes: 60 },
          { serviceId: 's2', quantity: 2, defaultDurationMinutes: 30 },
        ],
      },
      '10:00',
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].time).toBe('10:00');
    expect(lines[1].time).toBe('11:00');
    expect(lines[1].durationMinutes).toBe(30);
  });
});

describe('suggestVariant', () => {
  const variants = [
    { id: 'v1', seniorityTier: 'senior' },
    { id: 'v2', seniorityTier: null },
  ];
  it('sugere pela senioridade', () => expect(suggestVariant(variants, 'senior')).toBe('v1'));
  it('sem correspondência devolve null', () => {
    expect(suggestVariant(variants, 'junior')).toBeNull();
    expect(suggestVariant(variants, null)).toBeNull();
  });
});
