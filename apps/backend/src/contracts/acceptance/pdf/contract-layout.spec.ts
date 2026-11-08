import PDFDocument from 'pdfkit';
import { sampleSnapshotInput } from '../../domain/__fixtures__/snapshot-input';
import { buildSnapshot } from '../../domain/contract-snapshot';
import { packageSubText, renderStructuredContract } from './contract-layout';

/** Teste incluso no pacote (261108-n2o) na linha do pacote do PDF. */
describe('packageSubText', () => {
  const withTrial = () =>
    buildSnapshot(
      sampleSnapshotInput({
        items: [
          { serviceName: 'Maquiagem noiva', personLabel: 'Noiva', purpose: 'event', quantity: 1, totalCents: 155000, isPackageItem: true, sortOrder: 1 },
          { serviceName: 'Maquiagem noiva', personLabel: 'Noiva', purpose: 'trial', quantity: 1, totalCents: 155000, isPackageItem: true, sortOrder: 2, settledAtEvent: true },
          { serviceName: 'Maquiagem', personLabel: 'Mãe', purpose: 'event', quantity: 1, totalCents: 25000, isPackageItem: false, sortOrder: 3 },
          { serviceName: 'Penteado', personLabel: 'Madrinha', purpose: 'trial', quantity: 1, totalCents: 15000, isPackageItem: false, sortOrder: 4 },
        ],
      }),
    );

  it('descrição + teste incluso numa linha só', () => {
    expect(packageSubText(withTrial())).toBe(
      '**Descrição:** Maquiagem e penteado da noiva · **Inclui:** Maquiagem noiva (teste — incluso, pago no evento)',
    );
  });

  it('sem teste incluso fica só a descrição (como antes)', () => {
    expect(packageSubText(buildSnapshot(sampleSnapshotInput()))).toBe(
      '**Descrição:** Maquiagem e penteado da noiva',
    );
  });

  it('renderiza o PDF com o teste incluso sem erro', () => {
    const doc = new PDFDocument({ size: 'A4', bufferPages: true });
    doc.on('data', () => undefined);
    expect(() =>
      renderStructuredContract(doc, withTrial(), { letterhead: null, acceptance: null, notice: null }),
    ).not.toThrow();
    doc.end();
  });
});
