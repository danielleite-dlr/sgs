import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildSnapshot } from '../domain/contract-snapshot';
import { sampleSnapshotInput } from '../domain/__fixtures__/snapshot-input';
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

const LETTERHEAD = readFileSync(
  resolve(
    __dirname,
    '../../../../../.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-papel-timbrado-studio-js.png',
  ),
);
const PAGE_H = 841.89;
const BOTTOM = PAGE_H - (30 * 72) / 25.4;

/** Texto do PDF sem compressão: junta as strings hex de cada operador TJ. */
function pdfText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  const out: string[] = [];
  for (const m of raw.matchAll(/\[((?:<[0-9a-fA-F]*>|[^\]<])*)\]\s*TJ/g)) {
    let line = '';
    for (const h of m[1].matchAll(/<([0-9a-fA-F]*)>/g)) {
      line += Buffer.from(h[1], 'hex').toString('latin1');
    }
    out.push(line);
  }
  return out.join('\n');
}

const ACCEPTANCE = {
  name: 'Maria da Silva',
  cpfMasked: '***.456.789-**',
  acceptedAtLocal: '04/11/2026 10:30',
  ip: '203.0.113.7',
  sha256: 'b'.repeat(64),
  version: 1,
};

function structured(
  inputOverrides: Parameters<typeof sampleSnapshotInput>[0] = {},
  extra: Partial<Parameters<ContractPdfService['render']>[0]> = {},
) {
  const input = sampleSnapshotInput(inputOverrides);
  return {
    ...base,
    snapshot: buildSnapshot(input),
    letterhead: LETTERHEAD as Buffer | null,
    acceptance: null as typeof ACCEPTANCE | null,
    ...extra,
  };
}

describe('ContractPdfService (layout estruturado)', () => {
  const svc = new ContractPdfService();

  it('papel timbrado em todas as páginas, embutido uma vez, com opacidade 0,8 e margens respeitadas', async () => {
    const buf = await svc.render(
      structured({}, { notice: 'Aguardando aceite digital — documento não aceito' }),
      {
        compress: false,
      },
    );
    const raw = buf.toString('latin1');
    expect(raw).toContain('/ca 0.8');
    const images = raw.match(/\/Subtype \/Image/g) ?? [];
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images.length).toBeLessThanOrEqual(2);
    const pages = raw.match(/\/Type \/Page[^s]/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages.length).toBeLessThanOrEqual(3);
    // Fundo desenhado uma vez por página (Do), mesmo objeto de imagem.
    expect((raw.match(/\/I\d+ Do/g) ?? []).length).toBe(pages.length);
    expect(svc.lastProbe?.sectionPage.clauses).toBe(2);
    for (const y of svc.lastProbe?.maxY ?? []) expect(y).toBeLessThanOrEqual(BOTTOM + 1e-6);
  });

  it('sem papel timbrado não há imagem', async () => {
    const buf = await svc.render(structured({}, { letterhead: null }), {
      compress: false,
    });
    expect(buf.toString('latin1')).not.toContain('/Subtype /Image');
  });

  it('aviso pré-aceite não traz SHA-256; com aceite traz o bloco', async () => {
    const pre = pdfText(
      await svc.render(
        structured({}, { notice: 'Aguardando aceite digital — documento não aceito' }),
        {
          compress: false,
        },
      ),
    );
    expect(pre).toContain('Aguardando aceite digital');
    expect(pre).not.toContain('SHA-256:');
    const post = pdfText(
      await svc.render(structured({}, { acceptance: ACCEPTANCE }), {
        compress: false,
      }),
    );
    expect(post).toContain('Aceite digital');
    expect(post).toContain(`SHA-256: ${'b'.repeat(64)}`);
  });

  it('debutante mostra o rótulo; noiva não', async () => {
    const deb = pdfText(
      await svc.render(structured({ kind: 'debutante', debutanteName: 'Ana Clara' }), {
        compress: false,
      }),
    );
    expect(deb).toContain('Debutante:');
    expect(deb).toContain('Ana Clara');
    const noiva = pdfText(await svc.render(structured(), { compress: false }));
    expect(noiva).not.toContain('Debutante:');
  });

  it('modos de pagamento', async () => {
    const vista = pdfText(
      await svc.render(
        structured({
          payment: {
            mode: 'a_vista',
            installments: [{ seq: 1, dueDate: '2026-11-10', cents: 340000 }],
            balanceDueDaysBefore: 10,
          },
        }),
        { compress: false },
      ),
    );
    expect(vista).toContain('À VISTA');
    expect(vista).not.toContain('RESTANTE PAGAMENTO');

    const parc = pdfText(await svc.render(structured(), { compress: false }));
    expect(parc).toContain('SINAL 1/2');
    expect(parc).toContain('SINAL 2/2');
    expect(parc).toContain('Até 10 dias antes do evento');

    const sinal = pdfText(
      await svc.render(
        structured({
          payment: {
            mode: 'sinal',
            installments: [{ seq: 1, dueDate: '2026-11-10', cents: 40000 }],
            balanceDueDaysBefore: 10,
          },
        }),
        { compress: false },
      ),
    );
    expect(sinal).toContain('SINAL');
    expect(sinal).toContain('RESTANTE PAGAMENTO');
  });

  it('orçamento enorme não invade a margem inferior', async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      serviceName: `Serviço ${i}`,
      personLabel: 'Convidada',
      purpose: 'event' as const,
      quantity: 1,
      totalCents: 10000,
      isPackageItem: false,
      sortOrder: i + 1,
    }));
    await svc.render(
      structured({
        package: null,
        items,
        discount: { cents: 0, description: null },
        totalCents: 300000,
      }),
      { compress: false },
    );
    const probe = svc.lastProbe;
    expect(probe?.maxY.length).toBeGreaterThanOrEqual(3);
    for (const y of probe?.maxY ?? []) expect(y).toBeLessThanOrEqual(BOTTOM + 1e-6);
  });
});
