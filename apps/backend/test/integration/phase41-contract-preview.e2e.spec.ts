import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertContractRow,
  makeContractReady,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { ContractsService } from '../../src/contracts/contracts.service';

/**
 * Quick 261105-d6k: prévia do contrato em PDF a partir do formulário, sem gravar nada
 * (create/update rodam numa transação desfeita por erro sentinela).
 */

const PREVIEW = `query($input: ContractPreviewInput!) {
  contractPreviewPdf(input: $input) { filename base64 errors { code message field } }
}`;
const CREATE = `mutation($input: CreateContractInput!) {
  createContract(input: $input) { contract { id code discountAmount currentVersion } errors { code message field } }
}`;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

describe('Fase 4.1 - prévia do contrato (quick 261105-d6k)', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p41prev-%'`;
  const eventDate = localDay(60);
  let seq = 0;
  const uniq = () => `p41prev-noiva-${Date.now().toString(36)}-${++seq}`;

  beforeAll(async () => {
    w = await createPhase4World('p41prev');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
    await adminPrisma.client.deleteMany({
      where: {
        organizationId: w.orgId,
        fullName: { startsWith: 'p41prev-noiva-' },
      },
    });
  });

  const newGroupInput = (fullName = uniq()) => ({
    newGroup: {
      eventDate,
      bride: { newClient: { fullName, phone: '11988887777' } },
    },
    items: [{ serviceId: w.serviceId, unitPrice: '300.00' }],
  });

  const readyGroup = async () => {
    const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
    await makeContractReady(w, grp);
    return grp;
  };

  const counts = async () => {
    const org = { organizationId: w.orgId };
    const seqRows = await adminPrisma.contractSequence.findMany({ where: org });
    return {
      contracts: await adminPrisma.contract.count({ where: org }),
      items: await adminPrisma.contractItem.count({ where: org }),
      installments: await adminPrisma.contractDepositInstallment.count({
        where: org,
      }),
      versions: await adminPrisma.contractVersion.count({ where: org }),
      groups: await adminPrisma.bridalGroup.count({ where: org }),
      members: await adminPrisma.bridalGroupMember.count({ where: org }),
      memberServices: await adminPrisma.bridalMemberService.count({
        where: org,
      }),
      clients: await adminPrisma.client.count({ where: org }),
      audit: await adminPrisma.auditLog.count({ where: org }),
      liveTokens: await adminPrisma.contractAccessToken.count({
        where: { ...org, revokedAt: null },
      }),
      sequences: seqRows.map((s) => `${s.year}:${s.lastValue}`).sort(),
    };
  };

  it('newGroup: devolve um PDF válido sem erros', async () => {
    const r = await gqlAs(w, w.tokens.admin)(PREVIEW, {
      input: newGroupInput(),
    });
    expect(r.errors).toBeUndefined();
    const p = r.data.contractPreviewPdf;
    expect(p.errors).toEqual([]);
    expect(p.filename).toMatch(/^PREVIA - .+/);
    const buf = Buffer.from(p.base64, 'base64');
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('zero vazamento: 3 prévias não gravam nada e não consomem número de contrato', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const free = await readyGroup();
    const drafted = await readyGroup();
    const { contractId } = await insertContractRow(w, {
      groupId: drafted.groupId,
      brideClientId: drafted.brideClientId,
      totalAmount: '100.00',
      depositAmount: '0.00',
      items: [
        {
          groupMemberId: drafted.brideMemberId,
          serviceId: w.serviceId,
          unitPrice: '100.00',
        },
      ],
    });
    // token vivo: a prévia de edição não pode revogá-lo
    await adminPrisma.contractAccessToken.create({
      data: {
        organizationId: w.orgId,
        contractId,
        versionId: (
          await adminPrisma.contractVersion.findFirstOrThrow({
            where: { contractId },
          })
        ).id,
        tokenHash: `p41prev-${Date.now()}`.padEnd(64, '0').slice(0, 64),
        expiresAt: new Date(Date.now() + 86_400_000),
        createdBy: w.members.admin,
      },
    });
    const before = await counts();

    const a = await g(PREVIEW, { input: newGroupInput() });
    const b = await g(PREVIEW, {
      input: {
        groupId: free.groupId,
        packageId: w.bridalPackageId,
        discountAmount: '50.00',
      },
    });
    const c = await g(PREVIEW, {
      input: {
        contractId,
        discountAmount: '10.00',
        items: [{ serviceId: w.serviceBId, unitPrice: '80.00' }],
      },
    });
    for (const r of [a, b, c]) {
      expect(r.errors).toBeUndefined();
      expect(r.data.contractPreviewPdf.errors).toEqual([]);
      expect(r.data.contractPreviewPdf.base64).toBeTruthy();
    }

    expect(await counts()).toEqual(before);

    const real = await g(CREATE, {
      input: { groupId: free.groupId, items: [{ serviceId: w.serviceId }] },
    });
    expect(real.data.createContract.errors).toEqual([]);
    expect(real.data.createContract.contract.code).toBe(`CT-${eventDate.slice(0, 4)}-001`);
  });

  it('snapshot: código PRÉVIA, serviço, total com desconto e forma de pagamento do input', async () => {
    const svc = w.app.get(ContractsService);
    const service = await adminPrisma.service.findUniqueOrThrow({
      where: { id: w.serviceId },
    });
    const r = await svc.preview(w.orgId, w.members.admin, {
      ...newGroupInput(),
      discountAmount: '20.00',
      paymentMode: 'a_vista',
    });
    if (!('snapshot' in r)) throw new Error(JSON.stringify(r.errors));
    expect(r.snapshot.code).toBe('PRÉVIA');
    expect(r.snapshot.budget.extras.map((e) => e.label).join(' ')).toContain(service.name);
    expect(r.snapshot.budget.totalCents).toBe(28000);
    expect(r.snapshot.payment.mode).toBe('a_vista');

    const empty = await svc.preview(w.orgId, w.members.admin, {
      ...newGroupInput(),
      items: [],
    });
    if (!('snapshot' in empty)) throw new Error(JSON.stringify(empty.errors));
    expect(empty.snapshot.budget.totalCents).toBe(0);
    expect(empty.snapshot.budget.extras).toEqual([]);
  });

  it('contractId: dados do input sobrepõem o rascunho, que continua igual no banco', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const grp = await readyGroup();
    const created = await g(CREATE, {
      input: {
        groupId: grp.groupId,
        discountAmount: '5.00',
        items: [{ serviceId: w.serviceId, unitPrice: '200.00' }],
      },
    });
    expect(created.data.createContract.errors).toEqual([]);
    const id = created.data.createContract.contract.id;
    const r = await w.app.get(ContractsService).preview(w.orgId, w.members.admin, {
      contractId: id,
      discountAmount: '40.00',
    });
    if (!('snapshot' in r)) throw new Error(JSON.stringify(r.errors));
    expect(r.snapshot.budget.discount?.cents).toBe(4000);
    expect(r.snapshot.budget.totalCents).toBe(16000);
    const row = await adminPrisma.contract.findUniqueOrThrow({ where: { id } });
    expect(row.discountAmount.toString()).toBe('5');
    expect(row.currentVersion).toBe(1);
  });

  it('erros viram payload: parcelas, grupo com contrato e alvo ambíguo', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const grp = await readyGroup();
    const badInstallments = {
      groupId: grp.groupId,
      items: [{ serviceId: w.serviceId, unitPrice: '300.00' }],
      paymentMode: 'sinal_parcelado',
      depositAmount: '100.00',
      installments: [{ dueDate: localDay(5), amount: '30.00' }],
    };
    const prev = await g(PREVIEW, { input: badInstallments });
    expect(prev.errors).toBeUndefined();
    const real = await g(CREATE, { input: badInstallments });
    const realCode = real.data.createContract.errors[0]?.code;
    expect(realCode).toBeTruthy();
    expect(prev.data.contractPreviewPdf.errors[0].code).toBe(realCode);
    expect(prev.data.contractPreviewPdf.base64).toBeNull();
    expect(prev.data.contractPreviewPdf.filename).toBeNull();

    const ok = await g(CREATE, {
      input: { groupId: grp.groupId, items: [{ serviceId: w.serviceId }] },
    });
    expect(ok.data.createContract.errors).toEqual([]);
    const dup = await g(PREVIEW, {
      input: { groupId: grp.groupId, items: [{ serviceId: w.serviceId }] },
    });
    expect(dup.data.contractPreviewPdf.errors[0].code).toBe('GROUP_HAS_CONTRACT');

    const both = await g(PREVIEW, {
      input: { ...newGroupInput(), groupId: grp.groupId },
    });
    expect(both.data.contractPreviewPdf.errors[0].code).toBe('GROUP_REQUIRED');
    const none = await g(PREVIEW, {
      input: { items: [{ serviceId: w.serviceId }] },
    });
    expect(none.data.contractPreviewPdf.errors[0].code).toBe('GROUP_REQUIRED');
    const twoIds = await g(PREVIEW, {
      input: {
        groupId: grp.groupId,
        contractId: ok.data.createContract.contract.id,
      },
    });
    expect(twoIds.data.contractPreviewPdf.errors[0].code).toBe('GROUP_REQUIRED');
  });

  it('papel timbrado da org entra no PDF da prévia (mesmo renderizador do Baixar PDF)', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const plain = await g(PREVIEW, { input: newGroupInput() });
    const plainSize = Buffer.from(plain.data.contractPreviewPdf.base64, 'base64').length;
    const png = readFileSync(
      join(
        __dirname,
        '../../../../.planning/phases/04.1-layout-e-regras-do-contrato-modelo-studio-js/04.1-papel-timbrado-studio-js.png',
      ),
    );
    const up = await g(
      `mutation($input: UploadContractLetterheadInput!) {
        uploadContractLetterhead(input: $input) { errors { code } }
      }`,
      {
        input: { filename: 'timbrado.png', mimeType: 'image/png', base64: png.toString('base64') },
      },
    );
    expect(up.data.uploadContractLetterhead.errors).toEqual([]);
    const t0 = Date.now();
    const withLh = await g(PREVIEW, { input: newGroupInput() });
    const ms = Date.now() - t0;
    expect(withLh.data.contractPreviewPdf.errors).toEqual([]);
    const size = Buffer.from(withLh.data.contractPreviewPdf.base64, 'base64').length;
    expect(size).toBeGreaterThan(plainSize + 10_000);
    if (process.env.PREVIEW_METRICS) {
      process.stdout.write(`preview-metrics plain=${plainSize}B letterhead=${size}B ms=${ms}\n`);
    }
  });

  it('RBAC e RLS: atendente sem contract.write é barrada; outra org não vê o grupo', async () => {
    const grp = await readyGroup();
    const input = { groupId: grp.groupId, items: [{ serviceId: w.serviceId }] };
    const denied = await gqlAs(w, w.tokens.attendant)(PREVIEW, { input });
    const e = denied.errors?.[0];
    expect(`${e?.extensions?.code ?? ''} ${e?.message ?? ''}`).toMatch(/FORBIDDEN/);
    expect(denied.data?.contractPreviewPdf ?? null).toBeNull();

    const other = await gqlAs(w, w.tokens.otherAdmin)(PREVIEW, { input });
    expect(other.errors).toBeUndefined();
    expect(other.data.contractPreviewPdf.errors[0].code).toBe('GROUP_NOT_FOUND');
  });
});
