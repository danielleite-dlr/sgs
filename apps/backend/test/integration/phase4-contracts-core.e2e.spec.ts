import { createHash } from 'node:crypto';
import { adminPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  insertBridalGroupRow,
  makeContractReady,
  attachPackage,
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

  const newGroup = async () => {
    const grp = await insertBridalGroupRow(w, {
      companions: 4,
      covered: [true, true, false, false, false],
      eventDate,
    });
    await makeContractReady(w, grp);
    return grp;
  };

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
    // Formato 2: o hash é do snapshot estruturado, não do texto corrido.
    expect(c.currentTextSha256).toMatch(/^[0-9a-f]{64}$/);
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

  describe('pacote com serviços sem preço avulso', () => {
    /** cria serviços de preço 0 + pacote; apaga tudo no fim (o afterEach só limpa a Fase 4). */
    const created = { services: [] as string[], packages: [] as string[], rules: [] as string[] };
    const zeroService = async (name: string) => {
      const s = await adminPrisma.service.create({
        data: {
          organizationId: w.orgId,
          categoryId: w.childCategoryId,
          name: `p4core-${name}-${Date.now()}`,
          basePrice: '0.00',
          defaultDurationMinutes: 60,
        },
      });
      created.services.push(s.id);
      return s.id;
    };
    const fixedRule = async (serviceId: string, value: string) => {
      const r = await adminPrisma.commissionRule.create({
        data: { organizationId: w.orgId, scopeType: 'service', serviceId, kind: 'fixed', value },
      });
      created.rules.push(r.id);
    };
    const mkPackage = async (price: string, serviceIds: string[]) => {
      const p = await adminPrisma.package.create({
        data: {
          organizationId: w.orgId,
          name: `p4core-pacote-zero-${Date.now()}`,
          price,
          depositKind: 'percent',
          depositValue: '30.00',
          services: {
            create: serviceIds.map((serviceId, i) => ({ serviceId, quantity: 1, displayOrder: i })),
          },
        },
      });
      created.packages.push(p.id);
      return p.id;
    };
    const cents = (items: Array<{ total: string }>) => items.map((i) => Math.round(Number(i.total) * 100));

    afterEach(async () => {
      await deletePhase4Rows(orgFilter);
      await adminPrisma.commissionRule.deleteMany({ where: { id: { in: created.rules } } });
      await adminPrisma.packageService.deleteMany({ where: { packageId: { in: created.packages } } });
      await adminPrisma.package.deleteMany({ where: { id: { in: created.packages } } });
      await adminPrisma.service.deleteMany({ where: { id: { in: created.services } } });
      created.services = [];
      created.packages = [];
      created.rules = [];
    });

    it('itens da noiva rateados pelo repasse', async () => {
      const make = await zeroService('maquiagem');
      const hair = await zeroService('penteado');
      await fixedRule(make, '120.00');
      await fixedRule(hair, '80.00');
      const pkg = await mkPackage('2800.00', [make, hair]);
      const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
      const r = await gqlAs(w, w.tokens.admin)(CREATE, { input: { groupId: grp.groupId, packageId: pkg } });
      expect(r.data.createContract.errors).toEqual([]);
      const items = r.data.createContract.contract.items;
      expect(items.map((i: { unitPrice: string }) => i.unitPrice)).toEqual(['1680.00', '1120.00']);
      expect(items.map((i: { total: string }) => i.total)).toEqual(['1680.00', '1120.00']);
      expect(cents(items).reduce((a, b) => a + b, 0)).toBe(280000);
    });

    it('sem repasse divide igual, com o resto na última', async () => {
      const ids = [await zeroService('s1'), await zeroService('s2'), await zeroService('s3')];
      const pkg = await mkPackage('100.00', ids);
      const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
      const r = await gqlAs(w, w.tokens.admin)(CREATE, { input: { groupId: grp.groupId, packageId: pkg } });
      expect(r.data.createContract.errors).toEqual([]);
      const items = r.data.createContract.contract.items;
      expect(items.map((i: { total: string }) => i.total)).toEqual(['33.33', '33.33', '33.34']);
      expect(cents(items).reduce((a, b) => a + b, 0)).toBe(10000);
    });
  });

  describe('pacote do contrato vale para o grupo', () => {
    const groupPackage = async (groupId: string) =>
      (await adminPrisma.bridalGroup.findUniqueOrThrow({ where: { id: groupId } })).packageId;
    const brideServices = async (memberId: string) =>
      adminPrisma.bridalMemberService.findMany({
        where: { groupMemberId: memberId },
        select: { serviceId: true, purpose: true },
      });
    /** pacote extra só com o serviço B (os pacotes da org são apagados no cleanup da Fase 3). */
    const packageOnlyB = async () =>
      (
        await adminPrisma.package.create({
          data: {
            organizationId: w.orgId,
            name: `p4core-pacote-b-${Date.now()}`,
            price: '200.00',
            depositKind: 'percent',
            depositValue: '30.00',
            services: { create: [{ serviceId: w.serviceBId, quantity: 1, displayOrder: 0 }] },
          },
        })
      ).id;

    it('criar contrato com pacote grava o pacote no grupo e os serviços na noiva', async () => {
      const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
      expect(await groupPackage(grp.groupId)).toBeNull();
      const r = await gqlAs(w, w.tokens.admin)(CREATE, {
        input: { groupId: grp.groupId, packageId: w.bridalPackageId },
      });
      expect(r.data.createContract.errors).toEqual([]);
      expect(r.data.createContract.contract.totalAmount).toBe('500.00');
      expect(await groupPackage(grp.groupId)).toBe(w.bridalPackageId);
      const svc = await brideServices(grp.brideMemberId);
      expect(svc.filter((x) => x.purpose === 'event').map((x) => x.serviceId).sort()).toEqual(
        [w.serviceId, w.serviceBId].sort(),
      );
    });

    it('trocar o pacote no contrato atualiza o grupo e só adiciona; limpar não mexe no grupo', async () => {
      const g = gqlAs(w, w.tokens.admin);
      const pkgB = await packageOnlyB();
      const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
      const r = await g(CREATE, { input: { groupId: grp.groupId, packageId: pkgB } });
      expect(r.data.createContract.errors).toEqual([]);
      const id = r.data.createContract.contract.id;
      expect(await groupPackage(grp.groupId)).toBe(pkgB);
      expect((await brideServices(grp.brideMemberId)).map((x) => x.serviceId)).toEqual([w.serviceBId]);

      const up = await g(UPDATE, { id, input: { packageId: w.bridalPackageId } });
      expect(up.data.updateContract.errors).toEqual([]);
      expect(await groupPackage(grp.groupId)).toBe(w.bridalPackageId);
      const svc = await brideServices(grp.brideMemberId);
      expect(svc).toHaveLength(2);
      expect(svc.every((x) => x.purpose === 'event')).toBe(true);
      expect(svc.map((x) => x.serviceId).sort()).toEqual([w.serviceId, w.serviceBId].sort());

      const clear = await g(UPDATE, { id, input: { packageId: null } });
      expect(clear.data.updateContract.errors).toEqual([]);
      expect(clear.data.updateContract.contract.packageId).toBeNull();
      expect(await groupPackage(grp.groupId)).toBe(w.bridalPackageId);
      expect(await brideServices(grp.brideMemberId)).toHaveLength(2);
    });

    it('editar só o desconto não sobrescreve o pacote escolhido no grupo', async () => {
      const g = gqlAs(w, w.tokens.admin);
      const pkgB = await packageOnlyB();
      const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
      const r = await g(CREATE, { input: { groupId: grp.groupId, packageId: w.bridalPackageId } });
      expect(r.data.createContract.errors).toEqual([]);
      const id = r.data.createContract.contract.id;
      // a usuária troca o pacote no grupo depois do contrato
      await adminPrisma.bridalGroup.update({ where: { id: grp.groupId }, data: { packageId: pkgB } });

      const up = await g(UPDATE, { id, input: { discountAmount: '50.00' } });
      expect(up.data.updateContract.errors).toEqual([]);
      expect(up.data.updateContract.contract.packageId).toBe(w.bridalPackageId);
      expect(await groupPackage(grp.groupId)).toBe(pkgB);

      // reenviar o mesmo pacote do contrato também não sobrescreve
      const same = await g(UPDATE, { id, input: { packageId: w.bridalPackageId } });
      expect(same.data.updateContract.errors).toEqual([]);
      expect(await groupPackage(grp.groupId)).toBe(pkgB);

      // com o grupo sem pacote, o pacote do contrato volta a valer
      await adminPrisma.bridalGroup.update({ where: { id: grp.groupId }, data: { packageId: null } });
      const fill = await g(UPDATE, { id, input: { discountAmount: '60.00' } });
      expect(fill.data.updateContract.errors).toEqual([]);
      expect(await groupPackage(grp.groupId)).toBe(w.bridalPackageId);
    });
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
        depositAmount: '300.00',
      },
    });
    const id = created.data.createContract.contract.id;
    await attachPackage(w, id);

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
    // v1 (criação) + v2 (link: pacote vinculado depois da criação) + v3 (edição)
    expect(c.currentVersion).toBe(3);
    expect(c.totalAmount).toBe('900.00');
    expect(c.status).toBe('awaiting_acceptance');
    expect(c.needsAcceptance).toBe(true);
    const after = await adminPrisma.contractAccessToken.findMany({ where: { contractId: id } });
    expect(after[0].revokedAt).not.toBeNull();
    const versions = await adminPrisma.contractVersion.count({ where: { contractId: id } });
    expect(versions).toBe(3);

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

  describe('novo contrato pela noiva (newGroup)', () => {
    const PREFIX = 'p4core-nc-';
    const uniq = () => `${PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const ADD = `mutation($g: UUID!, $p: BridalPersonInput!) {
      addBridalGroupMember(groupId: $g, person: $p) {
        group { id members { id role coveredByContract } } errors { code message field }
      }
    }`;
    const counts = async () => ({
      groups: await adminPrisma.bridalGroup.count({ where: { organizationId: w.orgId } }),
      clients: await adminPrisma.client.count({ where: { organizationId: w.orgId } }),
      contracts: await adminPrisma.contract.count({ where: { organizationId: w.orgId } }),
    });

    afterEach(async () => {
      await deletePhase4Rows(orgFilter);
      await adminPrisma.client.deleteMany({
        where: { organizationId: w.orgId, fullName: { startsWith: PREFIX } },
      });
    });

    it('noiva nova + itens sem groupMemberId, sem pacote: grupo, membro e serviços planejados', async () => {
      const nome = uniq();
      const r = await gqlAs(w, w.tokens.admin)(CREATE, {
        input: {
          newGroup: { eventDate, bride: { newClient: { fullName: nome, phone: '11988887777' } } },
          items: [
            { serviceId: w.serviceId, unitPrice: '300.00' },
            { serviceId: w.serviceBId, unitPrice: '200.00' },
          ],
        },
      });
      expect(r.errors).toBeUndefined();
      expect(r.data.createContract.errors).toEqual([]);
      const c = r.data.createContract.contract;
      expect(c.status).toBe('draft');
      expect(c.totalAmount).toBe('500.00');
      expect(c.items).toHaveLength(2);
      expect(c.items.every((i: { personName: string }) => i.personName === nome)).toBe(true);
      const group = await adminPrisma.bridalGroup.findFirstOrThrow({
        where: { id: c.groupId },
        include: { members: { include: { services: true } } },
      });
      expect(group.status).toBe('active');
      expect(group.name).toBe(`Noiva ${nome}`);
      expect(group.eventDate.toISOString().slice(0, 10)).toBe(eventDate);
      expect(group.members).toHaveLength(1);
      expect(group.members[0].role).toBe('bride');
      expect(group.members[0].coveredByContract).toBe(true);
      expect(group.members[0].services).toHaveLength(2);
    });

    it('noiva existente + pacote, sem itens: itens rateados e package_id no grupo', async () => {
      const existing = await adminPrisma.client.create({
        data: { organizationId: w.orgId, fullName: uniq(), phone: '11977776666' },
      });
      const r = await gqlAs(w, w.tokens.admin)(CREATE, {
        input: {
          packageId: w.bridalPackageId,
          newGroup: { eventDate, bride: { clientId: existing.id } },
        },
      });
      expect(r.data.createContract.errors).toEqual([]);
      const c = r.data.createContract.contract;
      expect(c.totalAmount).toBe('500.00');
      const sum = c.items.reduce(
        (a: number, i: { total: string }) => a + Math.round(Number(i.total) * 100),
        0,
      );
      expect(sum).toBe(50000);
      expect(
        c.items.every((i: { packageId: string | null }) => i.packageId === w.bridalPackageId),
      ).toBe(true);
      const group = await adminPrisma.bridalGroup.findFirstOrThrow({ where: { id: c.groupId } });
      expect(group.packageId).toBe(w.bridalPackageId);
      expect(group.name).toBe(`Noiva ${existing.fullName}`);
    });

    it('debutante com responsável nova: contratante e nome automático', async () => {
      const deb = uniq();
      const resp = uniq();
      const r = await gqlAs(w, w.tokens.admin)(CREATE, {
        input: {
          packageId: w.bridalPackageId,
          newGroup: {
            eventKind: 'debutante',
            eventDate,
            bride: { newClient: { fullName: deb } },
            newResponsible: { fullName: resp, phone: '11966665555' },
          },
        },
      });
      expect(r.data.createContract.errors).toEqual([]);
      const c = r.data.createContract.contract;
      const group = await adminPrisma.bridalGroup.findFirstOrThrow({ where: { id: c.groupId } });
      expect(group.eventKind).toBe('debutante');
      expect(group.name).toBe(`Debutante ${deb}`);
      const contract = await adminPrisma.contract.findFirstOrThrow({ where: { id: c.id } });
      const responsible = await adminPrisma.client.findFirstOrThrow({
        where: { organizationId: w.orgId, fullName: resp },
      });
      expect(contract.contractorClientId).toBe(responsible.id);
    });

    it('respeita o nome informado (trim)', async () => {
      const r = await gqlAs(w, w.tokens.admin)(CREATE, {
        input: {
          packageId: w.bridalPackageId,
          newGroup: {
            eventDate,
            name: '  Casamento da Ana  ',
            bride: { newClient: { fullName: uniq() } },
          },
        },
      });
      expect(r.data.createContract.errors).toEqual([]);
      const group = await adminPrisma.bridalGroup.findFirstOrThrow({
        where: { id: r.data.createContract.contract.groupId },
      });
      expect(group.name).toBe('Casamento da Ana');
    });

    it('groupId e newGroup juntos, ou nenhum: GROUP_REQUIRED sem gravar nada', async () => {
      const g = gqlAs(w, w.tokens.admin);
      const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
      const before = await counts();
      const both = await g(CREATE, {
        input: {
          groupId: grp.groupId,
          packageId: w.bridalPackageId,
          newGroup: { eventDate, bride: { newClient: { fullName: uniq() } } },
        },
      });
      expect(both.data.createContract.errors[0]).toMatchObject({
        code: 'GROUP_REQUIRED',
        field: 'groupId',
      });
      const none = await g(CREATE, { input: { packageId: w.bridalPackageId } });
      expect(none.data.createContract.errors[0]).toMatchObject({
        code: 'GROUP_REQUIRED',
        field: 'groupId',
      });
      expect(await counts()).toEqual(before);
    });

    it('data inválida: INVALID_EVENT_DATE e rollback de grupo, cliente e contrato', async () => {
      const before = await counts();
      const r = await gqlAs(w, w.tokens.admin)(CREATE, {
        input: {
          packageId: w.bridalPackageId,
          newGroup: { eventDate: '2026-13-45', bride: { newClient: { fullName: uniq() } } },
        },
      });
      expect(r.data.createContract.contract).toBeNull();
      expect(r.data.createContract.errors[0].code).toBe('INVALID_EVENT_DATE');
      expect(await counts()).toEqual(before);
    });

    it('erro depois de criar o grupo (sem itens) também desfaz tudo', async () => {
      const before = await counts();
      const r = await gqlAs(w, w.tokens.admin)(CREATE, {
        input: { newGroup: { eventDate, bride: { newClient: { fullName: uniq() } } } },
      });
      expect(r.data.createContract.errors[0].code).toBe('ITEMS_REQUIRED');
      expect(await counts()).toEqual(before);
    });

    it('acompanhante adicionada depois entra sem cobertura e não muda os itens', async () => {
      const g = gqlAs(w, w.tokens.admin);
      const r = await g(CREATE, {
        input: {
          packageId: w.bridalPackageId,
          newGroup: { eventDate, bride: { newClient: { fullName: uniq() } } },
        },
      });
      const c = r.data.createContract.contract;
      const add = await g(ADD, {
        g: c.groupId,
        p: { newClient: { fullName: uniq() }, relationLabel: 'Mãe' },
      });
      expect(add.data.addBridalGroupMember.errors).toEqual([]);
      const members = add.data.addBridalGroupMember.group.members;
      expect(members).toHaveLength(2);
      expect(
        members.find((m: { role: string }) => m.role === 'companion').coveredByContract,
      ).toBe(false);
      const items = await adminPrisma.contractItem.count({ where: { contractId: c.id } });
      expect(items).toBe(c.items.length);
    });
  });
});

const FIELDS2 = `id totalAmount depositAmount paymentMode discountDescription eventKind
  contractorClientId contractorName brideName packageName depositOverdue
  installments { seq dueDate amount paidAmount pendingAmount state overdue }
  items { groupMemberId serviceId unitPrice quantity purpose isPackageItem }`;
const CREATE2 = `mutation($input: CreateContractInput!) {
  createContract(input: $input) { contract { ${FIELDS2} } errors { code message field } }
}`;
const UPDATE2 = `mutation($id: UUID!, $input: UpdateContractInput!) {
  updateContract(id: $id, input: $input) { contract { ${FIELDS2} } errors { code message field } }
}`;
const PAY2 = `mutation($input: RecordContractPaymentInput!) {
  recordContractPayment(input: $input) { contract { ${FIELDS2} } errors { code message field } }
}`;
const REVERSE2 = `mutation($input: ReverseContractPaymentInput!) {
  reverseContractPayment(input: $input) { contract { ${FIELDS2} } errors { code message field } }
}`;

describe('Fase 4.1 - forma de pagamento, parcelas e itens do pacote', () => {
  let w: Phase4World;
  const orgFilter = `SELECT id FROM organizations WHERE legal_name LIKE 'p41core-%'`;
  const eventDate = localDay(60);

  beforeAll(async () => {
    w = await createPhase4World('p41core');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(orgFilter);
  });

  const adm = () => gqlAs(w, w.tokens.admin);
  type Item = { groupMemberId: string; serviceId: string; unitPrice: string; purpose: string; isPackageItem: boolean };
  const asInput = (items: Item[]) =>
    items.map((i) => ({
      groupMemberId: i.groupMemberId,
      serviceId: i.serviceId,
      unitPrice: i.unitPrice,
      purpose: i.purpose,
    }));

  async function packageContract() {
    const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
    const r = await adm()(CREATE2, { input: { groupId: grp.groupId, packageId: w.bridalPackageId } });
    expect(r.data.createContract.errors).toEqual([]);
    return { grp, c: r.data.createContract.contract };
  }

  it('(a) editar só o desconto reenviando itens sem packageItem mantém o pacote', async () => {
    const { grp, c } = await packageContract();
    expect(c.items.length).toBeGreaterThan(0);
    expect(c.items.every((i: Item) => i.isPackageItem)).toBe(true);
    expect(c.packageName).toBeTruthy();
    const r = await adm()(UPDATE2, {
      id: c.id,
      input: { discountAmount: '10.00', items: asInput(c.items) },
    });
    expect(r.data.updateContract.errors).toEqual([]);
    const u = r.data.updateContract.contract;
    expect(u.items.every((i: Item) => i.isPackageItem)).toBe(true);
    expect(u.totalAmount).toBe('490.00');
    expect(grp.groupId).toBeTruthy();
  });

  it('(b)(c) packageItem false tira só aquele item; item novo sem flag é adicional', async () => {
    const { grp, c } = await packageContract();
    const items = asInput(c.items) as Record<string, unknown>[];
    items[0].packageItem = false;
    items.push({ groupMemberId: grp.brideMemberId, serviceId: w.serviceId, unitPrice: '50.00', purpose: 'trial' });
    const r = await adm()(UPDATE2, { id: c.id, input: { items } });
    expect(r.data.updateContract.errors).toEqual([]);
    const u = r.data.updateContract.contract;
    expect(u.items).toHaveLength(c.items.length + 1);
    expect(u.items.filter((i: Item) => !i.isPackageItem)).toHaveLength(2);
    expect(u.items.filter((i: Item) => i.isPackageItem)).toHaveLength(c.items.length - 1);
  });

  it('(d) sinal parcelado: soma conferida com tolerância de 1 centavo', async () => {
    const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
    const base = {
      groupId: grp.groupId,
      paymentMode: 'sinal_parcelado',
      depositAmount: '500.00',
      items: [{ groupMemberId: grp.brideMemberId, serviceId: w.serviceId, unitPrice: '2000.00' }],
    };
    const inst = (a: string, b: string) => [
      { dueDate: localDay(5), amount: a },
      { dueDate: localDay(20), amount: b },
    ];
    const ok = await adm()(CREATE2, { input: { ...base, installments: inst('300.00', '200.00') } });
    expect(ok.data.createContract.errors).toEqual([]);
    expect(ok.data.createContract.contract.installments).toHaveLength(2);
    expect(ok.data.createContract.contract.depositAmount).toBe('500.00');

    await deletePhase4Rows(orgFilter);
    const g2 = await insertBridalGroupRow(w, { companions: 0, eventDate });
    const b2 = { ...base, groupId: g2.groupId, items: [{ ...base.items[0], groupMemberId: g2.brideMemberId }] };
    const bad = await adm()(CREATE2, { input: { ...b2, installments: inst('300.00', '199.98') } });
    expect(bad.data.createContract.errors[0].code).toBe('INSTALLMENTS_SUM_MISMATCH');
    const tol = await adm()(CREATE2, { input: { ...b2, installments: inst('300.00', '199.99') } });
    expect(tol.data.createContract.errors).toEqual([]);
    expect(tol.data.createContract.contract.depositAmount).toBe('499.99');
  });

  it('(e) à vista: entrada = total com 1 parcela', async () => {
    const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
    const r = await adm()(CREATE2, {
      input: {
        groupId: grp.groupId,
        paymentMode: 'a_vista',
        items: [{ groupMemberId: grp.brideMemberId, serviceId: w.serviceId, unitPrice: '1000.00' }],
      },
    });
    expect(r.data.createContract.errors).toEqual([]);
    const c = r.data.createContract.contract;
    expect(c.depositAmount).toBe(c.totalAmount);
    expect(c.installments).toHaveLength(1);
    expect(c.installments[0].amount).toBe(c.totalAmount);
    expect(c.depositOverdue).toBe(false);
  });

  it('(f)(g) sinal sem parcelas gera 1 parcela de hoje; sinal 0 não gera; desconto descrito persiste', async () => {
    const g1 = await insertBridalGroupRow(w, { companions: 0, eventDate });
    const r = await adm()(CREATE2, {
      input: {
        groupId: g1.groupId,
        depositAmount: '300.00',
        discountAmount: '100.00',
        discountDescription: ' 10% OFF ',
        items: [{ groupMemberId: g1.brideMemberId, serviceId: w.serviceId, unitPrice: '1000.00' }],
      },
    });
    expect(r.data.createContract.errors).toEqual([]);
    const c = r.data.createContract.contract;
    expect(c.paymentMode).toBe('sinal');
    expect(c.discountDescription).toBe('10% OFF');
    expect(c.installments).toHaveLength(1);
    expect(c.installments[0]).toMatchObject({ amount: '300.00', dueDate: localDay(0), state: 'open' });

    const z = await adm()(UPDATE2, { id: c.id, input: { depositAmount: '0' } });
    expect(z.data.updateContract.errors).toEqual([]);
    expect(z.data.updateContract.contract.installments).toEqual([]);
    expect(z.data.updateContract.contract.discountDescription).toBe('10% OFF');
  });

  it('(h) packageItem true sem pacote é recusado', async () => {
    const grp = await insertBridalGroupRow(w, { companions: 0, eventDate });
    const r = await adm()(CREATE2, {
      input: {
        groupId: grp.groupId,
        items: [
          { groupMemberId: grp.brideMemberId, serviceId: w.serviceId, unitPrice: '100.00', packageItem: true },
        ],
      },
    });
    expect(r.data.createContract.errors[0].code).toBe('PACKAGE_ITEM_WITHOUT_PACKAGE');
  });

  it('parcelas: situação derivada após pagamento e estorno; contratante = responsável da debutante', async () => {
    const seed = await insertBridalGroupRow(w, { companions: 1, eventDate });
    const grp = await insertBridalGroupRow(w, {
      companions: 0,
      eventDate,
      eventKind: 'debutante',
      responsibleClientId: seed.companionClientIds.length ? seed.brideClientId : null,
    });
    const r = await adm()(CREATE2, {
      input: {
        groupId: grp.groupId,
        paymentMode: 'sinal_parcelado',
        items: [{ groupMemberId: grp.brideMemberId, serviceId: w.serviceId, unitPrice: '2000.00' }],
        installments: [
          { dueDate: localDay(-3), amount: '300.00' },
          { dueDate: localDay(20), amount: '200.00' },
        ],
      },
    });
    expect(r.data.createContract.errors).toEqual([]);
    const c = r.data.createContract.contract;
    expect(c.eventKind).toBe('debutante');
    expect(c.contractorClientId).toBe(seed.brideClientId);
    expect(c.contractorName).not.toBe(c.brideName);
    expect(c.installments[0]).toMatchObject({ state: 'open', overdue: true });

    const paid = await adm()(PAY2, {
      input: { contractId: c.id, lines: [{ method: 'pix', amount: '300.00' }] },
    });
    expect(paid.data.recordContractPayment.errors).toEqual([]);
    const p = paid.data.recordContractPayment.contract;
    expect(p.installments[0].state).toBe('paid');
    expect(p.installments[1].state).toBe('open');

    const payments = await adminPrisma.contractPayment.findMany({ where: { contractId: c.id } });
    const rev = await adm()(REVERSE2, {
      input: { paymentId: payments[0].id, reason: 'teste' },
    });
    expect(rev.data.reverseContractPayment.errors).toEqual([]);
    const back = rev.data.reverseContractPayment.contract;
    expect(back.installments[0]).toMatchObject({ state: 'open', overdue: true });
  });
});
