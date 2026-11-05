import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import PDFDocument from 'pdfkit';
import { adminPrisma, appPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const PNG_PATH = join(
  __dirname,
  '../../../../.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-papel-timbrado-studio-js.png',
);

const UPLOAD = `mutation($input: UploadContractLetterheadInput!) {
  uploadContractLetterhead(input: $input) {
    settings { letterhead { sha256 mimeType width height sizeBytes originalFilename } }
    errors { code message field }
  }
}`;
const REMOVE = `mutation {
  removeContractLetterhead { settings { letterhead { sha256 } } errors { code message field } }
}`;

// CRC32 para montar PNGs sintéticos em memória.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function ihdr(w: number, h: number): Buffer {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(w, 0);
  d.writeUInt32BE(h, 4);
  d[8] = 8; // 8 bits
  d[9] = 2; // RGB
  return chunk('IHDR', d);
}
/** PNG RGB 8 bits válido (preto) de w x h. */
function solidPng(w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  return Buffer.concat([
    SIG,
    ihdr(w, h),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('Fase 4.1 - papel timbrado do contrato', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4lh-%'`;
  const png = readFileSync(PNG_PATH);

  const input = (buf: Buffer, mimeType = 'image/png', filename = 'timbrado.png') => ({
    input: { filename, mimeType, base64: buf.toString('base64') },
  });
  const countRows = () =>
    adminPrisma.contractLetterhead.count({
      where: { organizationId: w.orgId },
    });

  beforeAll(async () => {
    w = await createPhase4World('p4lh');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await deletePhase4Rows(orgFilter);
  });

  it('envia o PNG do Studio JS e reenviar o mesmo arquivo não duplica a linha', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const r = await g(UPLOAD, input(png));
    expect(r.errors).toBeUndefined();
    expect(r.data.uploadContractLetterhead.errors).toEqual([]);
    expect(r.data.uploadContractLetterhead.settings.letterhead).toMatchObject({
      width: 795,
      height: 1122,
      mimeType: 'image/png',
      sizeBytes: png.length,
      originalFilename: 'timbrado.png',
    });
    const again = await g(UPLOAD, input(png));
    expect(again.data.uploadContractLetterhead.errors).toEqual([]);
    expect(await countRows()).toBe(1);

    const q = await g(`{ contractSettings { letterhead { sha256 width } } }`);
    expect(q.data.contractSettings.letterhead.width).toBe(795);
  });

  it('recusa tipo inválido (bytes aleatórios com mime png, GIF, mime divergente)', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const code = async (buf: Buffer, mime: string) =>
      (await g(UPLOAD, input(buf, mime))).data.uploadContractLetterhead.errors[0]?.code;
    expect(await code(Buffer.from('bytes aleatórios que não são imagem'), 'image/png')).toBe(
      'LETTERHEAD_TYPE',
    );
    expect(await code(Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1'), 'image/gif')).toBe(
      'LETTERHEAD_TYPE',
    );
    expect(await code(png, 'image/jpeg')).toBe('LETTERHEAD_TYPE');
    expect(await countRows()).toBe(0);
  });

  it('recusa proporção fora do A4 (PNG quadrado 100x100)', async () => {
    const r = await gqlAs(w, w.tokens.admin)(UPLOAD, input(solidPng(100, 100)));
    expect(r.data.uploadContractLetterhead.errors[0]).toMatchObject({
      code: 'LETTERHEAD_RATIO',
    });
    expect(r.data.uploadContractLetterhead.settings).toBeNull();
  });

  it('aceita PNG sintético com proporção A4 (200x283)', async () => {
    const r = await gqlAs(w, w.tokens.admin)(UPLOAD, input(solidPng(200, 283)));
    expect(r.data.uploadContractLetterhead.errors).toEqual([]);
  });

  it('IHDR gigante (20000x28284) é recusada sem abrir a imagem', async () => {
    const spy = jest.spyOn(PDFDocument.prototype, 'openImage');
    const forged = Buffer.concat([SIG, ihdr(20000, 28284), chunk('IEND', Buffer.alloc(0))]);
    const r = await gqlAs(w, w.tokens.admin)(UPLOAD, input(forged));
    expect(r.data.uploadContractLetterhead.errors[0].code).toBe('LETTERHEAD_UNSUPPORTED');
    expect(spy).not.toHaveBeenCalled();
  });

  it('arquivo de 2,6 MB é recusado por tamanho, sem 413', async () => {
    const big = Buffer.concat([SIG, Buffer.alloc(2_700_000, 7)]);
    const r = await gqlAs(w, w.tokens.admin)(UPLOAD, input(big));
    expect(r.data.uploadContractLetterhead.errors[0].code).toBe('LETTERHEAD_TOO_LARGE');
  });

  it('payload de ~3 MB (imagem de 2,2 MB) chega ao serviço: bodyLimit não dá 413', async () => {
    const buf = Buffer.concat([SIG, ihdr(795, 1122), Buffer.alloc(2_200_000, 1)]);
    const r = await gqlAs(w, w.tokens.admin)(UPLOAD, input(buf));
    expect(JSON.stringify(input(buf)).length).toBeGreaterThan(2_900_000);
    // não é 413: a resposta é GraphQL e o erro vem do serviço (imagem sem dados válidos)
    expect(r.data.uploadContractLetterhead.errors[0].code).toBe('LETTERHEAD_UNSUPPORTED');
  });

  it('remover zera o vínculo e mantém a linha em contract_letterheads', async () => {
    const g = gqlAs(w, w.tokens.admin);
    await g(UPLOAD, input(png));
    const r = await g(REMOVE);
    expect(r.data.removeContractLetterhead.errors).toEqual([]);
    expect(r.data.removeContractLetterhead.settings.letterhead).toBeNull();
    expect(await countRows()).toBe(1);
  });

  it('RLS: a organização B não vê a linha da A; UPDATE pelo papel da aplicação falha', async () => {
    await gqlAs(w, w.tokens.admin)(UPLOAD, input(png));
    const orgB = (
      await adminPrisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM organizations WHERE legal_name LIKE 'p4lh-%' AND id <> '${w.orgId}'::uuid LIMIT 1`,
      )
    )[0]!.id;
    const seenByB = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization', ${orgB}, true)`;
      return tx.contractLetterhead.count();
    });
    expect(seenByB).toBe(0);
    const seenByA = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization', ${w.orgId}, true)`;
      return tx.contractLetterhead.count();
    });
    expect(seenByA).toBe(1);

    await expect(
      appPrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_organization', ${w.orgId}, true)`;
        await tx.$executeRawUnsafe(`UPDATE contract_letterheads SET width = 1`);
      }),
    ).rejects.toThrow();

    const other = await gqlAs(
      w,
      w.tokens.otherAdmin,
    )(`{ contractSettings { letterhead { sha256 } } }`);
    expect(other.data.contractSettings.letterhead).toBeNull();
  });

  it('ATTENDANT e PROFESSIONAL não enviam nem removem', async () => {
    for (const token of [w.tokens.attendant, w.tokens.proA]) {
      const up = await gqlAs(w, token)(UPLOAD, input(png));
      expect(up.errors?.[0].message).toMatch(/permiss|permission|forbidden/i);
      const rm = await gqlAs(w, token)(REMOVE);
      expect(rm.errors?.[0].message).toMatch(/permiss|permission|forbidden/i);
    }
    expect(await countRows()).toBe(0);
  });
});
