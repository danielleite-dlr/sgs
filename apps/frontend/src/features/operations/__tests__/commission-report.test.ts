import { describe, it, expect } from 'vitest';
import { buildWhatsAppText, periodLabel, whatsAppUrl } from '../lib/commission-report';

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
});
