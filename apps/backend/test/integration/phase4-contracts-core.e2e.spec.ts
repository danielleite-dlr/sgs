import { createHash } from 'node:crypto';
import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  insertContractRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';

const CONTRACT_FIELDS = `id code status groupId brideName eventDate packageId itemsTotal discountAmount
  totalAmount depositAmount balanceDueDaysBefore balanceDueDate paid balance depositPaid depositPending
  settled daysToBalanceDue balanceDueSoon balanceOverdue depositOverdue cancellationPolicy
  currentVersion acceptedVersion needsAcceptance currentText currentTextSha256
  items { id personName description quantity unitPrice total packageId purpose }`;

const CREATE = `mutation($input: CreateContractInput!) {
  createContract(input: $input) { contract { ${CONTRACT_FIELDS} } errors { code message field } }
}`;
const UPDATE = `mutation($id: UUID!, $input: UpdateContractInput!) {
  updateContract(id: $id, input: $input) { contract { ${CONTRACT_FIELDS} } errors { code message field } }
}`;
const LINK = `mutation($id: UUID!) {
  generateContractLink(id: $id) { url expiresAt contract { id status } errors { code message } }
}`;

/** YYYY-MM-DD de hoje + n dias no fuso de São Paulo (fuso padrão das orgs de teste). */
function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

describe('Fase 4 - núcleo do contrato da noiva', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4core-%'`;
  const eventDate = localDay(60);

  beforeAll(async () => {
    w = await createPhase4World('p4core');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
  });

  const newGroup = () =>
    insertBridalGroupRow(w, {
      companions: 4,
      covered: [true, true, false, false, false],
      eventDate,
    });

  it('cria contrato de R$ 8.000 com desconto, entrada e prazo = evento - 10 dias', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const grp = await newGroup();
    const clause = 'Cláusula própria do estúdio sobre cancelamento do contrato.';
    await g(
      `mutation($i: UpdateContractSettingsInput!) { updateContractSettings(input: $i) { errors { code } } }`,
      { i: { cancellationClause: clause } },
    );
    const r = await g(CREATE, {
      input: {
        groupId: grp.groupId,
        discountAmount: '300.00',
        depositAmount: '2400.00',
        items: [
          { groupMemberId: grp.brideMemberId, serviceId: w.serviceId, unitPrice: '5000.00' },
          { groupMemberId: grp.companionMemberIds[0], serviceId: w.serviceId, unitPrice: '2000.00' },
          { groupMemberId: grp.companionMemberIds[1], serviceId: w.serviceBId, unitPrice: '1300.00' },
        ],
      },
    });
    expect(r.errors).toBeUndefined();
    expect(r.data.createContract.errors).toEqual([]);
    const c = r.data.createContract.contract;
    expect(c.itemsTotal).toBe('8300.00');
    expect(c.discountAmount).toBe('300.00');
    expect(c.totalAmount).toBe('8000.00');
    expect(c.depositAmount).toBe('2400.00');
    expect(c.status).toBe('draft');
    expect(c.code).toMatch(/^CT-\d{4}-\d{3}$/);
    expect(c.balanceDueDaysBefore).toBe(10);
    const expected = new Date(`${eventDate}T00:00:00Z`);
    expected.setUTCDate(expected.getUTCDate() - 10);
    expect(c.balanceDueDate).toBe(expected.toISOString().slice(0, 10));
    expect(c.cancellationPolicy.clientCancels).toBe('retain_all_paid');
    expect(c.cancellationPolicy.clause).toBe(clause);
    expect(c.currentVersion).toBe(1);
    expect(c.needsAcceptance).toBe(true);
    expect(c.items).toHaveLength(3);
    expect(c.depositPending).toBe('2400.00');
    expect(c.balance).toBe('8000.00');
    // texto e hash
    expect(c.currentText).not.toContain('{{');
    expect(c.currentText).toContain('R$');
    expect(c.currentTextSha256).toBe(
      createHash('sha256').update(c.currentText).digest('hex'),
    );
  });

  it('cria a partir do pacote sem itens: itens da noiva rateados e entrada de 30%', async () => {
    const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
    const r = await gqlAs(w, w.tokens.admin)(CREATE, {
      input: { groupId: grp.groupId, packageId: w.bridalPackageId },
    });
    expect(r.data.createContract.errors).toEqual([]);
    const c = r.data.createContract.contract;
    expect(c.totalAmount).toBe('500.00');
    expect(c.depositAmount).toBe('150.00');
    expect(c.packageId).toBe(w.bridalPackageId);
    const sum = c.items.reduce((a: number, i: { total: string }) => a + Math.round(Number(i.total) * 100), 0);
    expect(sum).toBe(50000);
    expect(c.items.every((i: { packageId: string | null }) => i.packageId === w.bridalPackageId)).toBe(true);
    expect(c.items[0].description).toContain('pacote');
  });

  it('item para acompanhante não coberta e segundo contrato vivo são rejeitados', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const grp = await newGroup();
    const bad = await g(CREATE, {
      input: {
        groupId: grp.groupId,
        items: [{ groupMemberId: grp.companionMemberIds[3], serviceId: w.serviceId }],
      },
    });
    expect(bad.data.createContract.errors[0].code).toBe('MEMBER_NOT_COVERED');

    const items = [{ groupMemberId: grp.brideMemberId, serviceId: w.serviceId }];
    const ok = await g(CREATE, { input: { groupId: grp.groupId, items } });
    expect(ok.data.createContract.errors).toEqual([]);
    const dup = await g(CREATE, { input: { groupId: grp.groupId, items } });
    expect(dup.data.createContract.errors[0].code).toBe('GROUP_HAS_CONTRACT');
  });

  it('valida desconto, entrada e itens obrigatórios', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const grp = await newGroup();
    const items = [{ groupMemberId: grp.brideMemberId, serviceId: w.serviceId }];
    const code = async (extra: Record<string, unknown>) =>
      (await g(CREATE, { input: { groupId: grp.groupId, items, ...extra } })).data.createContract
        .errors[0]?.code;
    expect(await code({ discountAmount: '101.00' })).toBe('DISCOUNT_GT_ITEMS');
    expect(await code({ depositAmount: '101.00' })).toBe('DEPOSIT_GT_TOTAL');
    expect(await code({ depositAmount: 'abc' })).toBe('INVALID_AMOUNT');
    const none = await g(CREATE, { input: { groupId: grp.groupId } });
    expect(none.data.createContract.errors[0].code).toBe('ITEMS_REQUIRED');
  });

  it('gera link /aceite/<orgId>/<token> guardando só o hash e revoga ao editar', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const grp = await newGroup();
    const created = await g(CREATE, {
      input: {
        groupId: grp.groupId,
        items: [{ groupMemberId: grp.brideMemberId, serviceId: w.serviceId, unitPrice: '1000.00' }],
      },
    });
    const id = created.data.createContract.contract.id;

    const l = await g(LINK, { id });
    expect(l.data.generateContractLink.errors).toEqual([]);
    const url: string = l.data.generateContractLink.url;
    expect(url).toContain(`/aceite/${w.orgId}/`);
    const token = url.split('/').pop() as string;
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(l.data.generateContractLink.contract.status).toBe('awaiting_acceptance');

    const rows = await adminPrisma.contractAccessToken.findMany({ where: { contractId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].revokedAt).toBeNull();
    const days = (rows[0].expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    const leaked = await adminPrisma.auditLog.count({
      where: { organizationId: w.orgId, metadata: { string_contains: token } },
    });
    expect(leaked).toBe(0);

    const up = await g(UPDATE, { id, input: { discountAmount: '100.00' } });
    expect(up.data.updateContract.errors).toEqual([]);
    const c = up.data.updateContract.contract;
    expect(c.currentVersion).toBe(2);
    expect(c.totalAmount).toBe('900.00');
    expect(c.status).toBe('awaiting_acceptance');
    expect(c.needsAcceptance).toBe(true);
    const after = await adminPrisma.contractAccessToken.findMany({ where: { contractId: id } });
    expect(after[0].revokedAt).not.toBeNull();
    const versions = await adminPrisma.contractVersion.count({ where: { contractId: id } });
    expect(versions).toBe(2);

    // novo link revoga o anterior e o antigo token deixa de ser o aberto
    const l2 = await g(LINK, { id });
    expect(l2.data.generateContractLink.errors).toEqual([]);
    const open = await adminPrisma.contractAccessToken.count({
      where: { contractId: id, revokedAt: null },
    });
    expect(open).toBe(1);
  });

  it('não gera link para versão já aceita e não deixa o total ficar abaixo do pago', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const grp = await newGroup();
    const { contractId } = await insertContractRow(w, {
      groupId: grp.groupId,
      brideClientId: grp.brideClientId,
      totalAmount: '1000.00',
      depositAmount: '300.00',
      status: 'active',
    });
    await adminPrisma.contract.update({
      where: { id: contractId },
      data: { acceptedVersion: 1 },
    });
    const l = await g(LINK, { id: contractId });
    expect(l.data.generateContractLink.errors[0].code).toBe('ALREADY_ACCEPTED');

    await adminPrisma.contractPayment.create({
      data: {
        organizationId: w.orgId,
        contractId,
        kind: 'payment',
        method: 'pix',
        amount: '800.00',
      },
    });
    const bride = await adminPrisma.bridalGroupMember.findFirstOrThrow({
      where: { id: grp.brideMemberId },
    });
    const up = await g(UPDATE, {
      id: contractId,
      input: {
        items: [{ groupMemberId: bride.id, serviceId: w.serviceId, unitPrice: '500.00' }],
        depositAmount: '0',
      },
    });
    expect(up.data.updateContract.errors[0].code).toBe('TOTAL_BELOW_PAID');
  });

  it('contrato cancelado não é editável', async () => {
    const grp = await newGroup();
    const { contractId } = await insertContractRow(w, {
      groupId: grp.groupId,
      brideClientId: grp.brideClientId,
      totalAmount: '1000.00',
      depositAmount: '0',
      status: 'cancelled',
    });
    const up = await gqlAs(w, w.tokens.admin)(UPDATE, {
      id: contractId,
      input: { discountAmount: '10.00' },
    });
    expect(up.data.updateContract.errors[0].code).toBe('CONTRACT_NOT_EDITABLE');
  });

  it('10 criações concorrentes geram códigos distintos e consecutivos', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const groups = await Promise.all(
      Array.from({ length: 10 }, () => insertBridalGroupRow(w, { eventDate })),
    );
    const results = await Promise.all(
      groups.map((grp) =>
        g(CREATE, {
          input: {
            groupId: grp.groupId,
            items: [{ groupMemberId: grp.brideMemberId, serviceId: w.serviceId }],
          },
        }),
      ),
    );
    results.forEach((r) => expect(r.data.createContract.errors).toEqual([]));
    const codes = results.map((r) => r.data.createContract.contract.code as string).sort();
    expect(new Set(codes).size).toBe(10);
    const nums = codes.map((c) => Number(c.split('-')[2]));
    expect(nums).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });

  it('status derivado: vence em 3 dias, vencido e filtro derived', async () => {
    const g = gqlAs(w, w.tokens.admin);
    const soonGrp = await newGroup();
    const lateGrp = await newGroup();
    const soon = await insertContractRow(w, {
      groupId: soonGrp.groupId,
      brideClientId: soonGrp.brideClientId,
      totalAmount: '8000.00',
      depositAmount: '2400.00',
      status: 'active',
      balanceDueDate: localDay(2),
    });
    const late = await insertContractRow(w, {
      groupId: lateGrp.groupId,
      brideClientId: lateGrp.brideClientId,
      totalAmount: '8000.00',
      depositAmount: '2400.00',
      status: 'active',
      balanceDueDate: localDay(-1),
    });
    for (const contractId of [soon.contractId, late.contractId]) {
      for (const amount of ['1000.00', '1500.00', '1000.00']) {
        await adminPrisma.contractPayment.create({
          data: { organizationId: w.orgId, contractId, kind: 'payment', method: 'pix', amount },
        });
      }
    }
    const q = `query($id: UUID!) { contract(id: $id) { paid balance depositPaid depositPending settled
      balanceDueSoon balanceOverdue daysToBalanceDue payments { amount kind reversed } } }`;
    const a = (await g(q, { id: soon.contractId })).data.contract;
    expect(a.paid).toBe('3500.00');
    expect(a.balance).toBe('4500.00');
    expect(a.depositPaid).toBe('2400.00');
    expect(a.depositPending).toBe('0.00');
    expect(a.settled).toBe(false);
    expect(a.balanceDueSoon).toBe(true);
    expect(a.balanceOverdue).toBe(false);
    expect(a.daysToBalanceDue).toBe(2);
    expect(a.payments).toHaveLength(3);

    const b = (await g(q, { id: late.contractId })).data.contract;
    expect(b.balanceOverdue).toBe(true);
    expect(b.balanceDueSoon).toBe(false);

    const overdue = await g(`{ contracts(derived: "overdue") { id } }`);
    expect(overdue.data.contracts.map((c: { id: string }) => c.id)).toEqual([late.contractId]);
    const dueSoon = await g(`{ contracts(derived: "due_soon") { id } }`);
    expect(dueSoon.data.contracts.map((c: { id: string }) => c.id)).toEqual([soon.contractId]);
    const bad = await g(`{ contracts(derived: "xyz") { id } }`);
    expect(bad.errors?.length).toBeGreaterThan(0);
  });

  it('RBAC e RLS: PROFESSIONAL sem leitura; outra organização não enxerga', async () => {
    const grp = await newGroup();
    const { contractId } = await insertContractRow(w, {
      groupId: grp.groupId,
      brideClientId: grp.brideClientId,
      totalAmount: '1000.00',
      depositAmount: '0',
    });
    const pro = await gqlAs(w, w.tokens.proA)(`{ contracts { id } }`);
    expect(pro.errors?.[0].message).toMatch(/permiss|permission|forbidden/i);
    const proCreate = await gqlAs(w, w.tokens.proA)(CREATE, {
      input: { groupId: grp.groupId },
    });
    expect(proCreate.errors).toBeDefined();

    const other = await gqlAs(w, w.tokens.otherAdmin)(
      `query($id: UUID!) { contract(id: $id) { id } }`,
      { id: contractId },
    );
    expect(other.data.contract).toBeNull();
    const list = await gqlAs(w, w.tokens.otherAdmin)(`{ contracts { id } }`);
    expect(list.data.contracts).toEqual([]);
  });
});
