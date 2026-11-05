import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import request from 'supertest';
import { adminPrisma } from './setup';
import {
  COMPLETE_CLIENT,
  completeStudioSettings,
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertContractRow,
  makeContractReady,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { ContractAcceptanceService } from '../../src/contracts/acceptance/contract-acceptance.service';
import { hashToken } from '../../src/contracts/domain/contract-token';

const MIGRATION = join(
  __dirname,
  '../../prisma/migrations/20261105000000_contract_layout_studio_js/migration.sql',
);
const PNG_PATH = join(
  __dirname,
  '../../../../.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-papel-timbrado-studio-js.png',
);

const CREATE = `mutation($input: CreateContractInput!) {
  createContract(input: $input) { contract { id code } errors { code message } }
}`;
const LINK = `mutation($id: UUID!) {
  generateContractLink(id: $id) {
    url contract { status currentVersion currentSnapshotFormat } errors { code message }
  }
}`;
const UPLOAD = `mutation($input: UploadContractLetterheadInput!) {
  uploadContractLetterhead(input: $input) {
    settings { letterhead { sha256 } } errors { code message }
  }
}`;

// PNG sintético válido (razão 1,411 como o papel real) com cor diferente para o hash mudar.
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
function solidPng(w: number, h: number): Buffer {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(w, 0);
  d.writeUInt32BE(h, 4);
  d[8] = 8;
  d[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0xee)]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', d),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe('Fase 4.1 - backfill D-18, versão sob demanda e papel timbrado por hash', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p41bf-%'`;

  beforeAll(async () => {
    w = await createPhase4World('p41bf');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
  });

  /**
   * Executa o trecho BEGIN/END BACKFILL do migration.sql. A migração real roda sobre todas as
   * orgs; aqui cada comando é restrito à org do teste para não mexer em outros dados do banco.
   */
  async function runBackfillSection(): Promise<void> {
    const sql = readFileSync(MIGRATION, 'utf8');
    const m = /-- BEGIN BACKFILL 04\.1\n([\s\S]*?)-- END BACKFILL 04\.1/.exec(sql);
    if (!m) throw new Error('trecho de backfill não encontrado');
    const org = `'${w.orgId}'::uuid`;
    const statements = m[1]
      .split(';\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    expect(statements).toHaveLength(3);
    const scoped = [
      statements[0].replace(
        'WHERE c.deposit_amount > 0',
        `WHERE c.organization_id = ${org} AND c.deposit_amount > 0`,
      ),
      statements[1].replace(
        'WHERE c.package_id IS NOT NULL',
        `WHERE c.organization_id = ${org} AND c.package_id IS NOT NULL`,
      ),
      statements[2].replace(
        'WHERE t.contract_id = c.id',
        `WHERE c.organization_id = ${org} AND t.contract_id = c.id`,
      ),
    ];
    scoped.forEach((s, i) => expect(s).not.toBe(statements[i]));
    for (const stmt of scoped) await adminPrisma.$executeRawUnsafe(stmt);
  }

  const localDate = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);

  it('migra pendentes, não mexe nos aceitos e é idempotente; versão sob demanda formato 2', async () => {
    const g = gqlAs(w, w.tokens.admin);

    // 1) ativo com entrada e sem parcelas
    const g1 = await insertBridalGroupRow(w, { eventDate: '2030-06-15' });
    const active = await insertContractRow(w, {
      groupId: g1.groupId,
      brideClientId: g1.brideClientId,
      totalAmount: '1000.00',
      depositAmount: '500.00',
      status: 'active',
    });

    // 2) rascunho com pacote e itens da noiva sem package_id (service A duplicado, B uma vez)
    const g2 = await insertBridalGroupRow(w, { eventDate: '2030-07-15' });
    const draft = await insertContractRow(w, {
      groupId: g2.groupId,
      brideClientId: g2.brideClientId,
      totalAmount: '1000.00',
      depositAmount: '300.00',
      status: 'draft',
      items: [
        { groupMemberId: g2.brideMemberId, serviceId: w.serviceId, unitPrice: '100.00' },
        { groupMemberId: g2.brideMemberId, serviceId: w.serviceId, unitPrice: '100.00' },
        { groupMemberId: g2.brideMemberId, serviceId: w.serviceBId, unitPrice: '100.00' },
      ],
    });
    await adminPrisma.contract.update({
      where: { id: draft.contractId },
      data: { packageId: w.bridalPackageId },
    });

    // 3) aguardando aceite, token ativo, versão legada
    const g3 = await insertBridalGroupRow(w, { eventDate: '2030-08-15' });
    await makeContractReady(w, g3);
    const awaiting = await insertContractRow(w, {
      groupId: g3.groupId,
      brideClientId: g3.brideClientId,
      totalAmount: '1000.00',
      depositAmount: '300.00',
      status: 'awaiting_acceptance',
      items: [{ groupMemberId: g3.brideMemberId, serviceId: w.serviceId, unitPrice: '1000.00' }],
    });
    await adminPrisma.contract.update({
      where: { id: awaiting.contractId },
      data: { packageId: w.bridalPackageId },
    });
    const awVersion = await adminPrisma.contractVersion.findFirstOrThrow({
      where: { contractId: awaiting.contractId },
    });
    await adminPrisma.contractAccessToken.create({
      data: {
        organizationId: w.orgId,
        contractId: awaiting.contractId,
        versionId: awVersion.id,
        tokenHash: hashToken(`token-legado-${randomUUID()}`),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    // 4) aceito (versão 1 legada + aceite)
    const g4 = await insertBridalGroupRow(w, { eventDate: '2030-09-15' });
    const accepted = await insertContractRow(w, {
      groupId: g4.groupId,
      brideClientId: g4.brideClientId,
      totalAmount: '1000.00',
      depositAmount: '200.00',
      status: 'active',
    });
    const accVersion = await adminPrisma.contractVersion.findFirstOrThrow({
      where: { contractId: accepted.contractId },
    });
    const acceptedAt = new Date('2026-01-10T15:00:00.000Z');
    await adminPrisma.contractAcceptance.create({
      data: {
        organizationId: w.orgId,
        contractId: accepted.contractId,
        versionId: accVersion.id,
        acceptedName: 'Maria Legado',
        acceptedCpf: '52998224725',
        acceptedAt,
        ip: '203.0.113.9',
        textSha256: accVersion.textSha256,
      },
    });
    await adminPrisma.contract.update({
      where: { id: accepted.contractId },
      data: { acceptedVersion: 1, acceptedAt },
    });

    await runBackfillSection();
    await runBackfillSection(); // idempotente

    // parcelas: uma por contrato com entrada, sem duplicar
    const inst = await adminPrisma.contractDepositInstallment.findMany({
      where: { organizationId: w.orgId },
      orderBy: { createdAt: 'asc' },
    });
    expect(inst).toHaveLength(4);
    const forActive = inst.filter((i) => i.contractId === active.contractId);
    expect(forActive).toHaveLength(1);
    expect(forActive[0].seq).toBe(1);
    expect(forActive[0].amount.toString()).toBe('500');
    const created = await adminPrisma.contract.findUniqueOrThrow({
      where: { id: active.contractId },
    });
    expect(forActive[0].dueDate.toISOString().slice(0, 10)).toBe(localDate(created.createdAt));
    const forAccepted = inst.find((i) => i.contractId === accepted.contractId)!;
    expect(forAccepted.dueDate.toISOString().slice(0, 10)).toBe('2026-01-10');

    // itens do pacote marcados respeitando quantity (A: 1 de 2; B: 1 de 1)
    const items = await adminPrisma.contractItem.findMany({
      where: { contractId: draft.contractId },
      orderBy: { sortOrder: 'asc' },
    });
    expect(items.filter((i) => i.packageId === w.bridalPackageId)).toHaveLength(2);
    expect(items[0].packageId).toBe(w.bridalPackageId);
    expect(items[1].packageId).toBeNull();
    expect(items[2].packageId).toBe(w.bridalPackageId);

    // token do aguardando revogado
    const tokens = await adminPrisma.contractAccessToken.findMany({
      where: { contractId: awaiting.contractId },
    });
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);

    // aceito intocado: versão, texto, hash e aceite; PDF do dono sai no formato legado
    const accAfter = await adminPrisma.contractVersion.findMany({
      where: { contractId: accepted.contractId },
    });
    expect(accAfter).toHaveLength(1);
    expect(accAfter[0]).toMatchObject({
      id: accVersion.id,
      renderedText: accVersion.renderedText,
      textSha256: accVersion.textSha256,
      snapshotFormat: 1,
    });
    expect(await adminPrisma.contractAcceptance.count({ where: { contractId: accepted.contractId } })).toBe(1);
    const svc = w.app.get(ContractAcceptanceService);
    const legacyPdf = await svc.pdfDataForOwner(w.orgId, accepted.contractId);
    expect(legacyPdf?.snapshot).toBeNull();
    expect(legacyPdf?.letterhead).toBeNull();
    expect(legacyPdf?.fileName).toBe(`contrato-${accepted.code}.pdf`);
    expect(legacyPdf?.text).toBe(accVersion.renderedText);
    expect(legacyPdf?.acceptance?.name).toBe('Maria Legado');

    // versão sob demanda: gerar o link do aguardando cria a versão 2 (formato 2)
    const link = await g(LINK, { id: awaiting.contractId });
    expect(link.data.generateContractLink.errors).toEqual([]);
    expect(link.data.generateContractLink.contract).toMatchObject({
      status: 'awaiting_acceptance',
      currentVersion: 2,
      currentSnapshotFormat: 2,
    });
    const newToken = (link.data.generateContractLink.url as string).split('/').pop() as string;
    const tokenRow = await adminPrisma.contractAccessToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(newToken) },
    });
    const v2 = await adminPrisma.contractVersion.findFirstOrThrow({
      where: { contractId: awaiting.contractId, version: 2 },
    });
    expect(tokenRow.versionId).toBe(v2.id);
    expect(v2.snapshotFormat).toBe(2);
    expect(tokenRow.revokedAt).toBeNull();
  });

  it('o aceito usa o papel timbrado do hash gravado, mesmo após o salão trocar o arquivo', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const svc = w.app.get(ContractAcceptanceService);
    const pngA = readFileSync(PNG_PATH);
    const pngB = solidPng(795, 1122);
    expect(sha(pngA)).not.toBe(sha(pngB));

    const up = async (buf: Buffer, filename: string) => {
      const r = await g(UPLOAD, {
        input: { filename, mimeType: 'image/png', base64: buf.toString('base64') },
      });
      expect(r.data.uploadContractLetterhead.errors).toEqual([]);
    };
    const newAcceptedContract = async (date: string) => {
      const grp = await insertBridalGroupRow(w, { companions: 0, eventDate: date });
      await makeContractReady(w, grp);
      const c = await g(CREATE, {
        input: { groupId: grp.groupId, packageId: w.bridalPackageId },
      });
      expect(c.data.createContract.errors).toEqual([]);
      const id = c.data.createContract.contract.id as string;
      const l = await g(LINK, { id });
      expect(l.data.generateContractLink.errors).toEqual([]);
      const token = (l.data.generateContractLink.url as string).split('/').pop() as string;
      const view = await request(w.app.getHttpServer())
        .get(`/public/contracts/${w.orgId}/${token}`)
        .set('X-Forwarded-For', '198.51.100.77');
      const ok = await request(w.app.getHttpServer())
        .post(`/public/contracts/${w.orgId}/${token}/accept`)
        .set('X-Forwarded-For', '198.51.100.78')
        .send({
          fullName: 'Maria da Silva',
          cpf: COMPLETE_CLIENT.cpf,
          accepted: true,
          textSha256: view.body.textSha256,
        });
      expect(ok.status).toBe(201);
      return { id, grp };
    };

    await completeStudioSettings(w);
    await up(pngA, 'a.png');
    const first = await newAcceptedContract('2030-10-15');
    const snapA = (await svc.pdfDataForOwner(w.orgId, first.id))!;
    expect(snapA.snapshot?.letterhead?.sha256).toBe(sha(pngA));
    expect(sha(snapA.letterhead!)).toBe(sha(pngA));

    await up(pngB, 'b.png'); // o salão troca o papel timbrado

    const afterSwap = (await svc.pdfDataForOwner(w.orgId, first.id))!;
    expect(afterSwap.acceptance).not.toBeNull();
    expect(sha(afterSwap.letterhead!)).toBe(sha(pngA)); // aceito continua com o papel A

    // contrato novo depois da troca usa o papel B (rascunho do dono)
    const grp2 = await insertBridalGroupRow(w, { companions: 0, eventDate: '2030-11-15' });
    await makeContractReady(w, grp2);
    const c2 = await g(CREATE, { input: { groupId: grp2.groupId, packageId: w.bridalPackageId } });
    const id2 = c2.data.createContract.contract.id as string;
    const draftPdf = (await svc.pdfDataForOwner(w.orgId, id2))!;
    expect(draftPdf.acceptance).toBeNull();
    expect(draftPdf.notice).toBe('Aguardando aceite digital — documento não aceito');
    expect(sha(draftPdf.letterhead!)).toBe(sha(pngB));
  });
});
