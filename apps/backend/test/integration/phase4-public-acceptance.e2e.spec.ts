import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { adminPrisma, appPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertContractRow,
  completeStudioSettings,
  COMPLETE_CLIENT,
  makeContractReady,
  attachPackage,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { hashToken } from '../../src/contracts/domain/contract-token';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const VALID_CPF = '529.982.247-25';

const CREATE = `mutation($input: CreateContractInput!) {
  createContract(input: $input) { contract { id code currentTextSha256 } errors { code message } }
}`;
const UPDATE = `mutation($id: UUID!, $input: UpdateContractInput!) {
  updateContract(id: $id, input: $input) { contract { id needsAcceptance } errors { code } }
}`;
const LINK = `mutation($id: UUID!) {
  generateContractLink(id: $id) { url errors { code message } }
}`;
const PDF = `query($id: UUID!) { contractPdf(id: $id) { filename base64 } }`;
const GET_STATE = `query($id: UUID!) { contract(id: $id) { status acceptedVersion needsAcceptance } }`;

/** IP distinto por chamada: o rate limit é por IP e a suíte faz muitas chamadas. */
let ipSeq = 0;
const freshIp = () => `198.51.100.${(++ipSeq % 250) + 1}`;

describe('Fase 4 - aceite público do contrato', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4acc-%'`;

  beforeAll(async () => {
    w = await createPhase4World('p4acc');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
  });

  const http = () => request(w.app.getHttpServer());

  /** Cria grupo + contrato + link; devolve ids, token em claro e hash do texto. */
  async function setup() {
    const g = gqlAs(w, w.tokens.admin);
    const grp = await insertBridalGroupRow(w, { companions: 0, eventDate: '2030-06-15' });
    await makeContractReady(w, grp);
    const created = await g(CREATE, {
      input: {
        groupId: grp.groupId,
        items: [{ groupMemberId: grp.brideMemberId, serviceId: w.serviceId, unitPrice: '1000.00' }],
        depositAmount: '300.00',
      },
    });
    const contract = created.data.createContract.contract;
    await attachPackage(w, contract.id);
    const link = await g(LINK, { id: contract.id });
    const token = (link.data.generateContractLink.url as string).split('/').pop() as string;
    // o link pode ter criado versão nova (D-18): o hash vigente é o da versão corrente
    const cur = await adminPrisma.contract.findUniqueOrThrow({ where: { id: contract.id } });
    const ver = await adminPrisma.contractVersion.findFirstOrThrow({
      where: { contractId: contract.id, version: cur.currentVersion },
    });
    return { g, grp, id: contract.id as string, code: contract.code as string, hash: ver.textSha256, token };
  }

  const accept = (
    token: string,
    body: Record<string, unknown>,
    ip = freshIp(),
    orgId = w.orgId,
  ) =>
    http()
      .post(`/public/contracts/${orgId}/${token}/accept`)
      .set('X-Forwarded-For', ip)
      .set('User-Agent', 'jest-agent/1.0')
      .send(body);

  const view = (token: string, orgId = w.orgId) =>
    http().get(`/public/contracts/${orgId}/${token}`).set('X-Forwarded-For', freshIp());

  it('GET válido devolve texto, hash e cabeçalhos privados', async () => {
    const s = await setup();
    const r = await view(s.token);
    expect(r.status).toBe(200);
    expect(r.body.text).toContain('R$');
    expect(r.body.textSha256).toBe(s.hash);
    expect(r.body.accepted).toBe(false);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-robots-tag']).toBe('noindex');
    expect(r.headers['referrer-policy']).toBe('no-referrer');
  });

  it('token inválido, org de outra org, org não-UUID e expirado respondem 404 genérico', async () => {
    const s = await setup();
    const bad = await view('x'.repeat(43));
    expect(bad.status).toBe(404);
    const msg = bad.body.message;

    const other = await view(s.token, w.otherOrgId);
    expect(other.status).toBe(404);
    expect(other.body.message).toBe(msg);

    const notUuid = await view(s.token, 'nao-e-uuid');
    expect(notUuid.status).toBe(404);
    expect(notUuid.body.message).toBe(msg);

    await adminPrisma.$executeRawUnsafe(
      `UPDATE contract_access_tokens SET expires_at = now() - interval '1 minute' WHERE contract_id = '${s.id}'::uuid`,
    );
    const expired = await view(s.token);
    expect(expired.status).toBe(404);
    expect(expired.body.message).toBe(msg);
  });

  it('valida nome, CPF, aceite e hash do texto', async () => {
    const s = await setup();
    const ok = { fullName: 'Maria da Silva', cpf: VALID_CPF, accepted: true, textSha256: s.hash };
    const cpf = await accept(s.token, { ...ok, cpf: '111.111.111-11' });
    expect(cpf.status).toBe(422);
    expect(cpf.body.code).toBe('INVALID_CPF');
    expect((await accept(s.token, { ...ok, fullName: 'Ma' })).body.code).toBe('INVALID_NAME');
    expect((await accept(s.token, { ...ok, accepted: false })).body.code).toBe('NOT_ACCEPTED');
    const changed = await accept(s.token, { ...ok, textSha256: 'f'.repeat(64) });
    expect(changed.status).toBe(409);
    expect(changed.body.code).toBe('TEXT_CHANGED');
    expect(await adminPrisma.contractAcceptance.count({ where: { contractId: s.id } })).toBe(0);
  });

  it('aceita gravando IP real, UA e hash; segundo aceite dá 409; registro é imutável', async () => {
    const s = await setup();
    const body = { fullName: '  Maria da Silva ', cpf: VALID_CPF, accepted: true, textSha256: s.hash };
    const r = await accept(s.token, body, '203.0.113.7');
    expect(r.status).toBe(201);

    const row = await adminPrisma.contractAcceptance.findFirstOrThrow({ where: { contractId: s.id } });
    expect(row.ip).toBe('203.0.113.7');
    expect(row.textSha256).toBe(s.hash);
    expect(row.acceptedName).toBe('Maria da Silva');
    expect(row.acceptedCpf).toBe('52998224725');
    expect(row.userAgent).toBe('jest-agent/1.0');

    const st = await s.g(GET_STATE, { id: s.id });
    expect(st.data.contract.status).toBe('active');
    expect(st.data.contract.acceptedVersion).toBe(2);
    expect(st.data.contract.needsAcceptance).toBe(false);

    const again = await accept(s.token, body);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_ACCEPTED');

    await expect(
      appPrisma.$executeRawUnsafe(
        `UPDATE contract_acceptances SET accepted_name = 'x' WHERE id = '${row.id}'::uuid`,
      ),
    ).rejects.toThrow(/permission denied/i);

    const audit = await adminPrisma.auditLog.count({
      where: { organizationId: w.orgId, action: 'contract.accept', entityId: s.id },
    });
    expect(audit).toBe(1);
  });

  it('view devolve o snapshot formato 2 com orçamento; versão legada devolve snapshot nulo', async () => {
    const s = await setup();
    const r = await view(s.token);
    expect(r.body.snapshot.format).toBe(2);
    expect(r.body.snapshot.budget).toBeDefined();
    expect(r.body.snapshot.budget.package).not.toBeNull();
    const ok = await accept(s.token, {
      fullName: 'Maria da Silva',
      cpf: VALID_CPF,
      accepted: true,
      textSha256: r.body.textSha256,
    });
    expect(ok.status).toBe(201);

    // legado: segunda versão inserida com snapshot_format = 1
    const g2 = await insertBridalGroupRow(w, { companions: 0, eventDate: '2030-07-15' });
    const c2 = await insertContractRow(w, {
      groupId: g2.groupId,
      brideClientId: g2.brideClientId,
      totalAmount: '1000.00',
      depositAmount: '300.00',
      status: 'awaiting_acceptance',
    });
    const v = await adminPrisma.contractVersion.findFirstOrThrow({
      where: { contractId: c2.contractId },
    });
    expect(v.snapshotFormat).toBe(1);
    const token2 = 'legacy-token-' + randomUUID().replace(/-/g, '');
    await adminPrisma.contractAccessToken.create({
      data: {
        organizationId: w.orgId,
        contractId: c2.contractId,
        versionId: v.id,
        tokenHash: hashToken(token2),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const lv = await view(token2);
    expect(lv.status).toBe(200);
    expect(lv.body.snapshot).toBeNull();
    expect(lv.body.text.length).toBeGreaterThan(0);
  });

  it('debutante: CPF da debutante dá CPF_MISMATCH e o da responsável é aceito (D-10)', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const resp = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'p4acc-responsavel', ...COMPLETE_CLIENT },
    });
    const grp = await insertBridalGroupRow(w, {
      companions: 0,
      eventDate: '2030-06-15',
      eventKind: 'debutante',
      responsibleClientId: resp.id,
      eventTime: '20:00',
    });
    await completeStudioSettings(w);
    await adminPrisma.client.update({
      where: { id: grp.brideClientId },
      data: { cpf: '168.995.350-09' },
    });
    const created = await g(CREATE, {
      input: { groupId: grp.groupId, packageId: w.bridalPackageId },
    });
    expect(created.data.createContract.errors).toEqual([]);
    const id = created.data.createContract.contract.id as string;
    const link = await g(LINK, { id });
    expect(link.data.generateContractLink.errors).toEqual([]);
    const token = (link.data.generateContractLink.url as string).split('/').pop() as string;
    const hash = (await view(token)).body.textSha256;
    const body = { fullName: 'Mãe da Debutante', accepted: true, textSha256: hash };

    const wrong = await accept(token, { ...body, cpf: '168.995.350-09' });
    expect(wrong.status).toBe(422);
    expect(wrong.body.code).toBe('CPF_MISMATCH');
    expect(wrong.body.message).toBe('O CPF não confere com o da contratante.');

    const ok = await accept(token, { ...body, cpf: COMPLETE_CLIENT.cpf });
    expect(ok.status).toBe(201);

    const pdf = await g(PDF, { id });
    expect(pdf.data.contractPdf.filename).toMatch(/^DEBUTANTE_.+\.pdf$/);
  });

  it('rejeita CPF diferente do cadastrado da noiva', async () => {
    const s = await setup();
    await adminPrisma.client.update({
      where: { id: s.grp.brideClientId },
      data: { cpf: '168.995.350-09' },
    });
    const r = await accept(s.token, {
      fullName: 'Maria da Silva',
      cpf: VALID_CPF,
      accepted: true,
      textSha256: s.hash,
    });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('CPF_MISMATCH');
  });

  it('editar o contrato revoga o link antigo e exige novo aceite', async () => {
    const s = await setup();
    const body = { fullName: 'Maria da Silva', cpf: VALID_CPF, accepted: true, textSha256: s.hash };
    expect((await accept(s.token, body)).status).toBe(201);

    const upd = await s.g(UPDATE, { id: s.id, input: { discountAmount: '10.00' } });
    expect(upd.data.updateContract.errors).toEqual([]);
    expect(upd.data.updateContract.contract.needsAcceptance).toBe(true);

    expect((await view(s.token)).status).toBe(404);
    const link2 = await s.g(LINK, { id: s.id });
    const token2 = (link2.data.generateContractLink.url as string).split('/').pop() as string;
    const v2 = await view(token2);
    expect(v2.status).toBe(200);
    expect(v2.body.version).toBe(3); // v1 criação, v2 link (pacote vinculado), v3 edição
    expect(v2.body.accepted).toBe(false);
    expect(v2.body.textSha256).not.toBe(s.hash);
  });

  it('PDF: 404 antes do aceite, 200 application/pdf depois; dono baixa via GraphQL', async () => {
    const s = await setup();
    const pdfUrl = `/public/contracts/${w.orgId}/${s.token}/pdf`;
    expect((await http().get(pdfUrl).set('X-Forwarded-For', freshIp())).status).toBe(404);
    // D-19: o dono baixa o rascunho antes do aceite (com aviso); o link público não.
    const draft = await s.g(PDF, { id: s.id });
    expect(draft.errors).toBeUndefined();
    expect(draft.data.contractPdf.filename).toMatch(/^NOIVA_.+\.pdf$/);
    expect(
      Buffer.from(draft.data.contractPdf.base64, 'base64').subarray(0, 5).toString(),
    ).toBe('%PDF-');

    await accept(s.token, {
      fullName: 'Maria da Silva',
      cpf: VALID_CPF,
      accepted: true,
      textSha256: s.hash,
    });

    const r = await http()
      .get(pdfUrl)
      .set('X-Forwarded-For', freshIp())
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('application/pdf');
    expect(r.headers['content-disposition']).toMatch(/filename="NOIVA_[A-Z0-9_-]+\.pdf"/);
    expect((r.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const owner = await s.g(PDF, { id: s.id });
    expect(owner.errors).toBeUndefined();
    expect(owner.data.contractPdf.filename).toMatch(/^NOIVA_.+\.pdf$/);
    expect(Buffer.from(owner.data.contractPdf.base64, 'base64').subarray(0, 5).toString()).toBe(
      '%PDF-',
    );
  });

  it('GET de org inexistente (UUID válido) também é 404', async () => {
    const s = await setup();
    expect((await view(s.token, randomUUID())).status).toBe(404);
  });
});
