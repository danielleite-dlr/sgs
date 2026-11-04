import { ContractPdfService } from './contract-pdf.service';

const base = {
  orgName: 'Studio JS',
  code: 'CT-2030-001',
  text: 'CONTRATO\n\nCláusula primeira, ação da noiva.\n'.repeat(5),
  version: 1,
  notice: null,
};

describe('ContractPdfService', () => {
  const svc = new ContractPdfService();

  it('gera PDF válido com bloco de aceite', async () => {
    const buf = await svc.render({
      ...base,
      acceptance: {
        name: 'Maria da Silva',
        cpfMasked: '***.456.789-**',
        acceptedAtLocal: '04/11/2026 10:30',
        ip: '203.0.113.7',
        sha256: 'a'.repeat(64),
        version: 1,
      },
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('não lança com acentos e sem aceite (com aviso de versão)', async () => {
    const buf = await svc.render({
      ...base,
      text: 'Cláusula, ação, noiva',
      notice: 'Versão aceita v1.',
      acceptance: null,
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('textos longos paginam sem erro', async () => {
    const buf = await svc.render({
      ...base,
      text: 'linha de contrato\n'.repeat(400),
      acceptance: null,
    });
    expect(buf.length).toBeGreaterThan(1000);
  });
});
