import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { ContractPdfData } from './contract-acceptance.service';
import { mm, renderStructuredContract } from './pdf/contract-layout';
import type { LayoutProbe } from './pdf/pdf-rich-text';

export interface RenderOptions {
  /** `false` deixa o conteúdo sem compressão (só para testes que inspecionam o texto). */
  compress?: boolean;
}

/** Gera o PDF do contrato (A4) com o texto aceito e o bloco de evidência do aceite digital. */
@Injectable()
export class ContractPdfService {
  /** Última medição de layout (apenas versões estruturadas); usada pelos testes. */
  lastProbe: LayoutProbe | null = null;

  render(data: ContractPdfData, options: RenderOptions = {}): Promise<Buffer> {
    return data.snapshot ? this.renderStructured(data, options) : this.renderLegacy(data, options);
  }

  private renderStructured(data: ContractPdfData, options: RenderOptions): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: mm(40), bottom: mm(30), left: mm(20), right: mm(20) },
        bufferPages: true,
        compress: options.compress ?? true,
        info: {
          Title: data.fileName ?? `Contrato ${data.code}`,
          Author: data.orgName,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.lastProbe = renderStructuredContract(
          doc,
          data.snapshot as NonNullable<typeof data.snapshot>,
          {
            letterhead: data.letterhead ?? null,
            acceptance: data.acceptance,
            notice: data.notice,
          },
        );
        this.drawFooters(doc, data);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Rodapé SGS em 7 pt, entre o conteúdo e o rodapé dourado do papel timbrado. */
  private drawFooters(doc: PDFKit.PDFDocument, data: ContractPdfData): void {
    const hash = data.acceptance?.sha256 ?? '';
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const m = doc.page.margins;
      const bottom = m.bottom;
      m.bottom = 0;
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#000000')
        .text(
          `Contrato ${data.code}${hash ? ` · SHA-256 ${hash}` : ''} · página ${i + 1} de ${range.count}`,
          m.left,
          doc.page.height - bottom + 6,
          {
            width: doc.page.width - m.left - m.right,
            align: 'center',
            lineBreak: false,
          },
        );
      m.bottom = bottom;
    }
  }

  private renderLegacy(data: ContractPdfData, options: RenderOptions): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 56,
        bufferPages: true,
        compress: options.compress ?? true,
        info: { Title: `Contrato ${data.code}`, Author: data.orgName },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const hash = data.acceptance?.sha256 ?? '';

      doc.font('Helvetica-Bold').fontSize(14).text(data.orgName);
      doc.text(`Contrato ${data.code}`);
      doc.moveDown();
      if (data.notice) {
        doc.font('Helvetica-Oblique').fontSize(10).text(data.notice);
        doc.moveDown();
      }
      doc.font('Helvetica').fontSize(11).text(data.text, { align: 'left' });

      if (data.acceptance) {
        const a = data.acceptance;
        doc.moveDown(2);
        doc.font('Helvetica-Bold').fontSize(12).text('Aceite digital');
        doc.font('Helvetica').fontSize(10);
        doc.text(`Nome: ${a.name}`);
        doc.text(`CPF: ${a.cpfMasked}`);
        doc.text(`Data e hora: ${a.acceptedAtLocal}`);
        doc.text(`IP: ${a.ip}`);
        doc.text(`Versão do contrato: ${a.version}`);
        doc.text(`SHA-256: ${a.sha256}`);
      }

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .font('Helvetica')
          .fontSize(7)
          .text(
            `Contrato ${data.code}${hash ? ` · SHA-256 ${hash}` : ''} · página ${i + 1} de ${range.count}`,
            56,
            doc.page.height - 36,
            { width: doc.page.width - 112, align: 'center', lineBreak: false },
          );
        doc.page.margins.bottom = bottom;
      }
      doc.end();
    });
  }
}
