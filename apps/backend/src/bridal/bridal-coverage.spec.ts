import { agreedUnitCents, type AgreedItem } from './bridal-coverage';

const NOIVA = 'm-noiva';
const MADRINHA = 'm-madrinha';
const MAKE = 's-make';
const MASSAGEM = 's-massagem';

function item(over: Partial<AgreedItem>): AgreedItem {
  return {
    groupMemberId: NOIVA,
    serviceId: MAKE,
    purpose: 'event',
    unitPrice: '0.00',
    settledAtEvent: false,
    ...over,
  };
}

describe('agreedUnitCents (teste incluso no pacote, 261108-n2o)', () => {
  const pacote = [
    item({ purpose: 'event', unitPrice: '200.01' }),
    item({ purpose: 'trial', unitPrice: '200.00', settledAtEvent: true }),
    item({ serviceId: MASSAGEM, purpose: 'event', unitPrice: '150.00' }),
  ];

  it('teste incluso sai a 0 (cobrado no evento)', () => {
    expect(agreedUnitCents(pacote, NOIVA, MAKE, 'trial')).toBe(0);
  });

  it('evento leva a parte do evento + a do teste incluso', () => {
    expect(agreedUnitCents(pacote, NOIVA, MAKE, 'event')).toBe(40001);
  });

  it('evento sem teste incluso fica com o próprio valor', () => {
    expect(agreedUnitCents(pacote, NOIVA, MASSAGEM, 'event')).toBe(15000);
  });

  it('teste avulso (não incluso) mantém o preço dele e não soma no evento', () => {
    const avulso = [
      item({ purpose: 'event', unitPrice: '400.00' }),
      item({ purpose: 'trial', unitPrice: '120.00' }),
    ];
    expect(agreedUnitCents(avulso, NOIVA, MAKE, 'trial')).toBe(12000);
    expect(agreedUnitCents(avulso, NOIVA, MAKE, 'event')).toBe(40000);
  });

  it('finalidade ausente no contrato → não coberto', () => {
    expect(agreedUnitCents(pacote, NOIVA, MASSAGEM, 'trial')).toBeUndefined();
  });

  it('serviço ou pessoa de fora → não coberto', () => {
    expect(agreedUnitCents(pacote, NOIVA, 's-outro', 'event')).toBeUndefined();
    expect(agreedUnitCents(pacote, MADRINHA, MAKE, 'event')).toBeUndefined();
    expect(agreedUnitCents(pacote, MADRINHA, MAKE, 'trial')).toBeUndefined();
  });

  it('teste incluso de outra pessoa não soma no evento da noiva', () => {
    const items = [
      item({ purpose: 'event', unitPrice: '100.00' }),
      item({ groupMemberId: MADRINHA, purpose: 'trial', unitPrice: '50.00', settledAtEvent: true }),
    ];
    expect(agreedUnitCents(items, NOIVA, MAKE, 'event')).toBe(10000);
  });

  it('soma teste + evento cobrados = valor do serviço no contrato', () => {
    const t = agreedUnitCents(pacote, NOIVA, MAKE, 'trial') ?? 0;
    const e = agreedUnitCents(pacote, NOIVA, MAKE, 'event') ?? 0;
    expect(t + e).toBe(20001 + 20000);
  });
});
