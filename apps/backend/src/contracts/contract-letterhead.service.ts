import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { recordAudit } from '../common/audit-log';
import { TenantContextService } from '../database/tenant-context.service';
import type { TenantPrismaClient } from '../database/types';
import { ContractError, mapContractError, type ContractUserError } from './contract-errors';
import { ContractSettingsService, type ContractSettingsView } from './contract-settings.service';

export const MAX_LETTERHEAD_BYTES = 2_621_440; // 2,5 MB
export const MAX_LETTERHEAD_WIDTH = 6000;
export const MAX_LETTERHEAD_HEIGHT = 8500;
/** A4 retrato = 1,414; tolerância de ~3%. */
export const MIN_LETTERHEAD_RATIO = 1.372;
export const MAX_LETTERHEAD_RATIO = 1.457;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export interface UploadLetterheadInput {
  filename: string;
  mimeType: string;
  base64: string;
}

const invalid = () =>
  new ContractError('LETTERHEAD_INVALID', 'Não foi possível ler a imagem enviada.', 'base64');

/**
 * Lê largura/altura só do cabeçalho do arquivo, sem decodificar pixels
 * (protege contra bomba de descompressão antes de abrir a imagem).
 */
export function readImageDimensions(buf: Buffer): {
  width: number;
  height: number;
} {
  if (buf.subarray(0, 8).equals(PNG_MAGIC)) {
    // assinatura (8) + tamanho do chunk (4) + "IHDR" (4) + largura (4) + altura (4)
    if (buf.length < 24 || buf.toString('latin1', 12, 16) !== 'IHDR') throw invalid();
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.subarray(0, 3).equals(JPEG_MAGIC)) {
    let pos = 2;
    while (pos + 4 <= buf.length) {
      if (buf[pos] !== 0xff) {
        pos += 1;
        continue;
      }
      const marker = buf[pos + 1]!;
      if (marker === 0xff) {
        pos += 1; // preenchimento
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        pos += 2; // marcadores sem payload
        continue;
      }
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        if (pos + 9 > buf.length) throw invalid();
        return {
          height: buf.readUInt16BE(pos + 5),
          width: buf.readUInt16BE(pos + 7),
        };
      }
      const len = buf.readUInt16BE(pos + 2);
      if (len < 2) throw invalid();
      pos += 2 + len;
    }
  }
  throw invalid();
}

/** Bytes do papel timbrado por hash (usado só pelo PDF; nunca exposto no GraphQL). */
export async function loadLetterheadTx(
  tx: TenantPrismaClient,
  sha256: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const row = await tx.contractLetterhead.findFirst({
    where: { sha256 },
    select: { data: true, mimeType: true },
  });
  return row ? { data: Buffer.from(row.data), mimeType: row.mimeType } : null;
}

@Injectable()
export class ContractLetterheadService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly settings: ContractSettingsService,
  ) {}

  async upload(
    orgId: string,
    memberId: string,
    input: UploadLetterheadInput,
  ): Promise<{
    settings: ContractSettingsView | null;
    errors: ContractUserError[];
  }> {
    try {
      const b64 = input.base64.replace(/\s+/g, '');
      if (b64.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw invalid();
      const buf = Buffer.from(b64, 'base64');
      if (buf.length === 0) throw invalid();

      const isPng = buf.subarray(0, 8).equals(PNG_MAGIC);
      const isJpeg = buf.subarray(0, 3).equals(JPEG_MAGIC);
      const mimeOk =
        (input.mimeType === 'image/png' && isPng) || (input.mimeType === 'image/jpeg' && isJpeg);
      if (!mimeOk) {
        throw new ContractError('LETTERHEAD_TYPE', 'Envie uma imagem PNG ou JPG.', 'mimeType');
      }
      if (buf.length > MAX_LETTERHEAD_BYTES) {
        throw new ContractError('LETTERHEAD_TOO_LARGE', 'Imagem maior que 2,5 MB.', 'base64');
      }

      // Dimensões do cabeçalho ANTES de decodificar qualquer pixel.
      const dims = readImageDimensions(buf);
      if (dims.width > MAX_LETTERHEAD_WIDTH || dims.height > MAX_LETTERHEAD_HEIGHT) {
        throw new ContractError(
          'LETTERHEAD_UNSUPPORTED',
          'Imagem grande demais (máx. 6000 × 8500 px).',
          'base64',
        );
      }

      let width: number;
      let height: number;
      try {
        // openImage existe no pdfkit mas falta em @types/pdfkit.
        const doc = new PDFDocument({ autoFirstPage: false }) as unknown as {
          openImage(b: Buffer): { width: number; height: number };
        };
        const img = doc.openImage(buf);
        width = img.width;
        height = img.height;
      } catch {
        throw new ContractError(
          'LETTERHEAD_UNSUPPORTED',
          'Formato de imagem não suportado (use PNG 8 bits ou JPG).',
          'base64',
        );
      }
      if (width !== dims.width || height !== dims.height) throw invalid();

      const ratio = height / width;
      if (ratio < MIN_LETTERHEAD_RATIO || ratio > MAX_LETTERHEAD_RATIO) {
        throw new ContractError(
          'LETTERHEAD_RATIO',
          'A imagem deve ter proporção A4 (retrato).',
          'base64',
        );
      }

      const sha256 = createHash('sha256').update(buf).digest('hex');
      const filename = input.filename.trim().slice(0, 200) || null;

      const settings = await this.tenant.runWithTenant(orgId, async (tx) => {
        await tx.contractLetterhead.createMany({
          data: [
            {
              organizationId: orgId,
              sha256,
              mimeType: input.mimeType,
              width,
              height,
              sizeBytes: buf.length,
              originalFilename: filename,
              data: buf,
              uploadedBy: memberId,
            },
          ],
          skipDuplicates: true,
        });
        await tx.contractSettings.upsert({
          where: { organizationId: orgId },
          create: {
            organizationId: orgId,
            letterheadSha256: sha256,
            updatedBy: memberId,
          },
          update: { letterheadSha256: sha256, updatedBy: memberId },
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: memberId,
          action: 'contract.letterhead.updated',
          entityType: 'contract_settings',
          entityId: orgId,
          metadata: { sha256, sizeBytes: buf.length, width, height },
        });
        return this.settings.getEffective(tx, orgId);
      });
      return { settings, errors: [] };
    } catch (e) {
      const m = mapContractError(e);
      if (m) return { settings: null, errors: [m] };
      throw e;
    }
  }

  /** Desvincula o papel timbrado; a linha antiga fica (versões aceitas usam o sha delas). */
  async remove(
    orgId: string,
    memberId: string,
  ): Promise<{
    settings: ContractSettingsView | null;
    errors: ContractUserError[];
  }> {
    try {
      const settings = await this.tenant.runWithTenant(orgId, async (tx) => {
        await tx.contractSettings.upsert({
          where: { organizationId: orgId },
          create: {
            organizationId: orgId,
            letterheadSha256: null,
            updatedBy: memberId,
          },
          update: { letterheadSha256: null, updatedBy: memberId },
        });
        await recordAudit(tx, {
          orgId,
          actorMemberId: memberId,
          action: 'contract.letterhead.removed',
          entityType: 'contract_settings',
          entityId: orgId,
        });
        return this.settings.getEffective(tx, orgId);
      });
      return { settings, errors: [] };
    } catch (e) {
      const m = mapContractError(e);
      if (m) return { settings: null, errors: [m] };
      throw e;
    }
  }
}
