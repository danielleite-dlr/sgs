import { describe, expect, it } from 'vitest';
import {
  buildCreateVisitInput,
  expandPackageAt,
  expandPackageLines,
  packageStartTime,
  removePackageLines,
  sequenceTimes,
  suggestVariant,
} from '../lib/visit-form';

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

describe('expandPackageLines — Make & Penteado (D-12)', () => {
  const makePenteado = {
    services: [
      { serviceId: 'make', quantity: 1, defaultDurationMinutes: 60 },
      { serviceId: 'penteado', quantity: 1, defaultDurationMinutes: 60 },
    ],
  };
  it('make e penteado nunca saem no mesmo horário', () => {
    const lines = expandPackageLines(makePenteado, '10:00');
    expect(lines.map((l) => l.time)).toEqual(['10:00', '11:00']);
  });
  it('duração 0, negativa ou NaN vira 60 e a seguinte começa depois', () => {
    for (const bad of [0, -5, Number.NaN]) {
      const lines = expandPackageLines(
        {
          services: [
            { serviceId: 'make', quantity: 1, defaultDurationMinutes: bad },
            { serviceId: 'penteado', quantity: 1, defaultDurationMinutes: 60 },
          ],
        },
        '10:00',
      );
      expect(lines[0].durationMinutes).toBe(60);
      expect(lines.map((l) => l.time)).toEqual(['10:00', '11:00']);
    }
  });
  it('mesmo serviço duas vezes (quantity 2) vira uma linha só', () => {
    const lines = expandPackageLines(
      {
        services: [
          { serviceId: 'make', quantity: 2, defaultDurationMinutes: 60 },
          { serviceId: 'make', quantity: 1, defaultDurationMinutes: 60 },
        ],
      },
      '10:00',
    );
    expect(lines).toHaveLength(1);
  });
});

describe('packageStartTime', () => {
  it('usa a hora da própria linha', () => {
    expect(packageStartTime([{ time: '10:30', durationMinutes: 60 }], 0)).toBe('10:30');
  });
  it('linha sem hora começa no fim da linha preenchida acima', () => {
    expect(
      packageStartTime(
        [
          { time: '10:00', durationMinutes: 60 },
          { time: '', durationMinutes: 0 },
        ],
        1,
      ),
    ).toBe('11:00');
  });
  it('sem nenhuma hora válida usa 09:00', () => {
    expect(packageStartTime([{ time: '', durationMinutes: 0 }], 0)).toBe('09:00');
    expect(packageStartTime([{ time: '1', durationMinutes: 0 }], 0)).toBe('09:00');
  });
});

describe('expandPackageAt', () => {
  it('troca só a linha do índice, mantendo as de cima e de baixo', () => {
    expect(expandPackageAt(['a', 'b', 'c'], 1, ['x', 'y'])).toEqual(['a', 'x', 'y', 'c']);
  });
  it('funciona no primeiro e no último índice', () => {
    expect(expandPackageAt(['a', 'b', 'c'], 0, ['x', 'y'])).toEqual(['x', 'y', 'b', 'c']);
    expect(expandPackageAt(['a', 'b', 'c'], 2, ['x', 'y'])).toEqual(['a', 'b', 'x', 'y']);
  });
});

describe('removePackageLines', () => {
  const mk = () => ({ id: 'novo', fromPackage: false });
  it('tira só as linhas do pacote', () => {
    const out = removePackageLines(
      [
        { id: 'a', fromPackage: false },
        { id: 'p1', fromPackage: true },
        { id: 'p2', fromPackage: true },
        { id: 'c', fromPackage: false },
      ],
      mk,
    );
    expect(out.map((l) => l.id)).toEqual(['a', 'c']);
  });
  it('se só havia linhas do pacote, fica uma linha vazia', () => {
    const out = removePackageLines([{ id: 'p1', fromPackage: true }], mk);
    expect(out).toEqual([mk()]);
  });
});

describe('sequenceTimes', () => {
  it('monta a sequência a partir da hora inicial', () => {
    expect(sequenceTimes('10:00', [75, 60])).toEqual(['10:00', '11:15']);
  });
  it('hora vazia ou inválida devolve horas vazias', () => {
    expect(sequenceTimes('', [60, 60])).toEqual(['', '']);
    expect(sequenceTimes('1', [60, 60])).toEqual(['', '']);
  });
  it('duração 0 vira 60', () => {
    expect(sequenceTimes('10:00', [0, 60])).toEqual(['10:00', '11:00']);
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
