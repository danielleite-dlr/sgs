import { describe, it, expect } from 'vitest';
import {
  buildWhatsAppText,
  periodLabel,
  reportRows,
  whatsAppUrl,
  type CommissionRowLike,
} from '../lib/commission-report';

const row = (id: string, over: Partial<CommissionRowLike> = {}): CommissionRowLike => ({
  id,
  serviceDate: '2026-11-17T13:00:00Z',
  clientName: 'Ewelly',
  itemName: 'Maquiagem noiva',
  chargedAmount: '0.00',
  calculatedAmount: '0.00',
  kind: 'accrual',
  reversed: false,
  ...over,
});

describe('commission-report', () => {
  it('periodLabel usa o último dia incluído (to exclusivo)', () => {
    expect(periodLabel('2026-11-01', '2026-12-01')).toBe('01/11/2026 a 30/11/2026');
    expect(periodLabel('2026-11-17', '2026-11-18')).toBe('17/11/2026');
  });

  it('whatsAppUrl põe o 55 em telefone brasileiro e aceita sem telefone', () => {
    expect(whatsAppUrl('(11) 97777-6666', 'oi')).toBe('https://wa.me/5511977776666?text=oi');
    expect(whatsAppUrl('+55 11 97777-6666', 'oi')).toBe('https://wa.me/5511977776666?text=oi');
    expect(whatsAppUrl(null, 'a b')).toBe('https://wa.me/?text=a%20b');
    expect(whatsAppUrl('123', 'x')).toBe('https://wa.me/?text=x');
  });

  it('buildWhatsAppText lista atendimentos, estorno e total', () => {
    const text = buildWhatsAppText({
      salonName: 'Studio JS',
      memberName: 'Ana',
      from: '2026-11-01',
      to: '2026-12-01',
      total: '10.00',
      rows: [
        { serviceDate: '2026-11-10T13:00:00Z', clientName: 'Bia', itemName: 'Make', chargedAmount: '100.00', calculatedAmount: '20.00', kind: 'accrual' },
        { serviceDate: '2026-11-10T13:00:00Z', clientName: null, itemName: 'Make', chargedAmount: '100.00', calculatedAmount: '-10.00', kind: 'reversal' },
      ],
    });
    expect(text).toContain('*Relatório de comissões — Studio JS*');
    expect(text).toContain('Período: 01/11/2026 a 30/11/2026');
    expect(text).toContain('10/11/2026 · Bia · Make · R$ 20,00');
    expect(text).toContain('Cliente não informado · Make (estorno)');
    expect(text.endsWith('*Total: R$ 10,00*')).toBe(true);
  });

  it('reportRows: some com o par estornado e junta o teste incluso ao dia da noiva', () => {
    const out = reportRows([
      row('t1', { calculatedAmount: '400.00', reversed: true, bridalTrialIncluded: true, contractId: 'c' }),
      row('t1r', { kind: 'reversal', calculatedAmount: '-400.00', reversesRecordId: 't1', bridalTrialIncluded: true, contractId: 'c' }),
      row('t2', { calculatedAmount: '400.00', bridalTrialIncluded: true, contractId: 'c' }),
      row('ev', { serviceDate: '2026-11-20T13:00:00Z', calculatedAmount: '400.00', chargedAmount: '0.00', contractId: 'c', trialDate: '2026-11-17T13:00:00Z' }),
      row('x', { clientName: 'Bia', itemName: 'Penteado', calculatedAmount: '50.00', chargedAmount: '100.00' }),
    ]);
    expect(out.map((r) => r.id)).toEqual(['ev', 'x']);
    // soma não muda: 400 (teste antigo) + 400 (evento)
    expect(out[0].calculatedAmount).toBe('800.00');
    expect(out[0].note).toBe('Dia da noiva + teste em 17/11/2026 (1 atendimento)');
    expect(out[1].note).toBeUndefined();
  });

  it('reportRows: teste sem o dia da noiva no período avisa; estorno de mês anterior fica', () => {
    const out = reportRows([
      row('t', { bridalTrialIncluded: true, contractId: 'c' }),
      row('r', { kind: 'reversal', calculatedAmount: '-10.00', reversesRecordId: 'fora' }),
    ]);
    expect(out.map((r) => r.id)).toEqual(['t', 'r']);
    expect(out[0].note).toBe('Teste da noiva (incluso; comissão no dia da noiva)');
  });
});
