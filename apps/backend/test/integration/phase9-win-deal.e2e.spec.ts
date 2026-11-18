import { adminPrisma } from './setup';
import { COMPLETE_CLIENT } from './helpers/phase4-fixtures';
import {
  createPhase9World,
  destroyPhase9World,
  gqlAs,
  insertDealRow,
  insertLeadRow,
  type Phase9World,
} from './helpers/phase9-fixtures';

const WIN = `mutation($i: WinCommercialDealInput!) {
  winCommercialDeal(input: $i) { contractId clientId errors { code field } }
}`;

type Gql = ReturnType<typeof gqlAs>;

function localDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

const MODAL = {
  cpf: COMPLETE_CLIENT.cpf,
  rg: COMPLETE_CLIENT.rg,
  postalCode: COMPLETE_CLIENT.postalCode,
  address: COMPLETE_CLIENT.address,
  phone2: COMPLETE_CLIENT.phone2,
};

describe('fase 9 — ganho do negócio (COM-08)', () => {
  let w: Phase9World;
  let asManager: Gql;
  let asAttendant: Gql;
  let asAttendantB: Gql;
  let asPro: Gql;

  beforeAll(async () => {
    w = await createPhase9World('p9win');
    asManager = gqlAs(w, w.tokens.manager);
    asAttendant = gqlAs(w, w.tokens.attendant);
    asAttendantB = gqlAs(w, w.attendantB.token);
    asPro = gqlAs(w, w.tokens.proA);
  });

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  const counts = async () => ({
    clients: await adminPrisma.client.count({ where: { organizationId: w.orgId } }),
    groups: await adminPrisma.bridalGroup.count({ where: { organizationId: w.orgId } }),
    contracts: await adminPrisma.contract.count({ where: { organizationId: w.orgId } }),
    payments: await adminPrisma.contractPayment.count({ where: { organizationId: w.orgId } }),
  });

  async function openDeal(opts: {
    kind?: 'noiva' | 'debutante';
    assignee?: string | null;
    packageId?: string | null;
    eventDate?: string;
    beneficiaryName?: string | null;
    leadClientId?: string | null;
    leadPhone?: string | null;
  }) {
    const leadId = await insertLeadRow(w, {
      fullName: 'Lead Ganho',
      clientId: opts.leadClientId ?? null,
      ...(opts.leadPhone !== undefined ? { phone: opts.leadPhone } : {}),
    });
    const dealId = await insertDealRow(w, {
      leadId,
      kind: opts.kind,
      assignee: opts.assignee ?? null,
      packageId: opts.packageId,
      eventDate: opts.eventDate === undefined ? localDay(90) : opts.eventDate || undefined,
      beneficiaryName: opts.beneficiaryName,
    });
    return { leadId, dealId };
  }

  it('noiva sem cliente ligada: cria cliente, grupo e contrato rascunho e fecha o negócio', async () => {
    const { leadId, dealId } = await openDeal({});
    await adminPrisma.commercialDeal.update({
      where: { id: dealId },
      data: { discountAmount: '50.00' },
    });
    const before = await counts();
    const res = await asManager(WIN, {
      i: { dealId, client: MODAL, depositPaid: false },
    });
    const p = res.data.winCommercialDeal;
    expect(p.errors).toEqual([]);
    const after = await counts();
    expect(after.clients).toBe(before.clients + 1);
    expect(after.groups).toBe(before.groups + 1);
    expect(after.contracts).toBe(before.contracts + 1);
    expect(after.payments).toBe(before.payments);

    const client = await adminPrisma.client.findUniqueOrThrow({ where: { id: p.clientId } });
    expect(client.fullName).toBe('Lead Ganho');
    expect(client.cpf).toBe(COMPLETE_CLIENT.cpf);
    const contract = await adminPrisma.contract.findUniqueOrThrow({ where: { id: p.contractId } });
    expect(contract.status).toBe('draft');
    expect(contract.packageId).toBe(w.bridalPackageId);
    expect(Number(contract.discountAmount)).toBe(50);
    const group = await adminPrisma.bridalGroup.findUniqueOrThrow({
      where: { id: contract.bridalGroupId },
    });
    expect(group.eventKind).toBe('noiva');
    expect(group.eventDate.toISOString().slice(0, 10)).toBe(localDay(90));

    const deal = await adminPrisma.commercialDeal.findUniqueOrThrow({
      where: { id: dealId },
      include: { stage: true },
    });
    expect(deal.status).toBe('won');
    expect(deal.stage.kind).toBe('won');
    expect(deal.closedAt).not.toBeNull();
    expect(deal.wonContractId).toBe(p.contractId);
    expect(deal.wonClientId).toBe(p.clientId);
    const lead = await adminPrisma.commercialLead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.clientId).toBe(p.clientId);
  });

  it('lead ligado a cliente existente: não cria cliente e atualiza CPF/endereço', async () => {
    const existing = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Cliente Antiga', phone: '(11) 97777-0001' },
    });
    const { dealId } = await openDeal({ leadClientId: existing.id });
    const before = await counts();
    const res = await asManager(WIN, { i: { dealId, client: MODAL, depositPaid: false } });
    const p = res.data.winCommercialDeal;
    expect(p.errors).toEqual([]);
    expect(p.clientId).toBe(existing.id);
    expect((await counts()).clients).toBe(before.clients);
    const c = await adminPrisma.client.findUniqueOrThrow({ where: { id: existing.id } });
    expect(c.cpf).toBe(COMPLETE_CLIENT.cpf);
    expect(c.address).toBe(COMPLETE_CLIENT.address);
    expect(c.fullName).toBe('Cliente Antiga');
  });

  it('lead sem vínculo mas com telefone de cliente do SGS: usa essa cliente e liga o lead', async () => {
    const phone = `(11) 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const existing = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Cliente Mesma Linha', phone },
    });
    const { leadId, dealId } = await openDeal({ leadPhone: phone });
    const before = await counts();
    const res = await asManager(WIN, { i: { dealId, client: MODAL, depositPaid: false } });
    const p = res.data.winCommercialDeal;
    expect(p.errors).toEqual([]);
    expect(p.clientId).toBe(existing.id);
    expect((await counts()).clients).toBe(before.clients);
    const lead = await adminPrisma.commercialLead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.clientId).toBe(existing.id);
  });

  it('sinal pago entra como pagamento do contrato e no caixa', async () => {
    const { dealId } = await openDeal({});
    const res = await asManager(WIN, {
      i: {
        dealId,
        client: MODAL,
        depositPaid: true,
        depositLines: [{ method: 'pix', amount: '150.00' }],
      },
    });
    const p = res.data.winCommercialDeal;
    expect(p.errors).toEqual([]);
    const pays = await adminPrisma.contractPayment.findMany({
      where: { contractId: p.contractId },
    });
    expect(pays).toHaveLength(1);
    expect(Number(pays[0].amount)).toBe(150);
    const cash = await adminPrisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM cash_movements
      WHERE organization_id = ${w.orgId}::uuid AND contract_id = ${p.contractId}::uuid`;
    expect(Number(cash[0].n)).toBe(1);
  });

  it('sem pacote ou sem data do evento: erro e nada gravado', async () => {
    const noPkg = await openDeal({ packageId: null });
    const noDate = await openDeal({ eventDate: '' });
    const before = await counts();
    const a = await asManager(WIN, { i: { dealId: noPkg.dealId, depositPaid: false } });
    expect(a.data.winCommercialDeal.errors[0].code).toBe('PACKAGE_REQUIRED');
    const b = await asManager(WIN, { i: { dealId: noDate.dealId, depositPaid: false } });
    expect(b.data.winCommercialDeal.errors[0].code).toBe('EVENT_DATE_REQUIRED');
    expect(await counts()).toEqual(before);
  });

  it('CPF inválido e método de pagamento inválido desfazem tudo', async () => {
    const { dealId } = await openDeal({});
    const before = await counts();
    const cpf = await asManager(WIN, {
      i: { dealId, client: { cpf: '111.111.111-11' }, depositPaid: false },
    });
    expect(cpf.data.winCommercialDeal.errors[0].code).toBe('CPF_INVALID');
    expect(await counts()).toEqual(before);

    const bad = await asManager(WIN, {
      i: {
        dealId,
        client: MODAL,
        depositPaid: true,
        depositLines: [{ method: 'cheque', amount: '100.00' }],
      },
    });
    expect(bad.data.winCommercialDeal.errors[0].code).toBe('INVALID_METHOD');
    expect(await counts()).toEqual(before);
    const deal = await adminPrisma.commercialDeal.findUniqueOrThrow({ where: { id: dealId } });
    expect(deal.status).toBe('open');
  });

  it('dois cliques simultâneos geram um contrato só; o outro recebe DEAL_CLOSED', async () => {
    const { dealId } = await openDeal({});
    const before = await counts();
    const [a, b] = await Promise.all([
      asManager(WIN, { i: { dealId, client: MODAL, depositPaid: false } }),
      asManager(WIN, { i: { dealId, client: MODAL, depositPaid: false } }),
    ]);
    const pa = a.data.winCommercialDeal;
    const pb = b.data.winCommercialDeal;
    const oks = [pa, pb].filter((p) => p.errors.length === 0);
    const closed = [pa, pb].filter((p) => p.errors[0]?.code === 'DEAL_CLOSED');
    expect(oks).toHaveLength(1);
    expect(closed).toHaveLength(1);
    expect((await counts()).contracts).toBe(before.contracts + 1);

    const again = await asManager(WIN, { i: { dealId, depositPaid: false } });
    expect(again.data.winCommercialDeal.errors[0].code).toBe('DEAL_CLOSED');
  });

  it('debutante: contratante é o lead e a debutante entra como noiva do grupo', async () => {
    const { leadId, dealId } = await openDeal({
      kind: 'debutante',
      packageId: w.debutantePackageId,
    });
    const before = await counts();
    const none = await asManager(WIN, { i: { dealId, client: MODAL, depositPaid: false } });
    expect(none.data.winCommercialDeal.errors[0].code).toBe('BENEFICIARY_REQUIRED');
    expect(await counts()).toEqual(before);

    const res = await asManager(WIN, {
      i: { dealId, client: MODAL, beneficiaryName: 'Sofia', depositPaid: false },
    });
    const p = res.data.winCommercialDeal;
    expect(p.errors).toEqual([]);
    const contract = await adminPrisma.contract.findUniqueOrThrow({ where: { id: p.contractId } });
    const group = await adminPrisma.bridalGroup.findUniqueOrThrow({
      where: { id: contract.bridalGroupId },
      include: { members: { include: { client: true } } },
    });
    expect(group.eventKind).toBe('debutante');
    expect(group.responsibleClientId).toBe(p.clientId);
    const bride = group.members.find((m) => m.role === 'bride');
    expect(bride?.client?.fullName).toBe('Sofia');
    const lead = await adminPrisma.commercialLead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.clientId).toBe(p.clientId);
    const deal = await adminPrisma.commercialDeal.findUniqueOrThrow({ where: { id: dealId } });
    expect(deal.beneficiaryName).toBe('Sofia');
  });

  it('permissão: atendente dona ganha sem contract.write; outra atendente NOT_FOUND; profissional FORBIDDEN', async () => {
    const { dealId } = await openDeal({ assignee: w.members.attendant });
    const other = await asAttendantB(WIN, { i: { dealId, depositPaid: false } });
    expect(other.data.winCommercialDeal.errors[0].code).toBe('NOT_FOUND');

    const pro = await asPro(WIN, { i: { dealId, depositPaid: false } });
    expect(pro.data?.winCommercialDeal ?? null).toBeNull();
    expect(JSON.stringify(pro.errors)).toMatch(/FORBIDDEN/);

    const own = await asAttendant(WIN, { i: { dealId, client: MODAL, depositPaid: false } });
    expect(own.data.winCommercialDeal.errors).toEqual([]);
    expect(own.data.winCommercialDeal.contractId).toBeTruthy();
  });
});
