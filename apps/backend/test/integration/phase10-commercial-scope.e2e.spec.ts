import { COMPLETE_CLIENT } from './helpers/phase4-fixtures';
import { insertDealRow, insertLeadRow } from './helpers/phase9-fixtures';
import {
  clearOverrides,
  createPhase10World,
  destroyPhase10World,
  gqlAs,
  setOverrideRow,
  type Phase10World,
} from './helpers/phase10-fixtures';

const REPORT = `query($f: CommercialReportFilter!) {
  commercialReport(filter: $f) { totals { deals } rows { dealId } }
}`;
const DEALS = `query($f: CommercialDealFilter) { commercialDeals(filter: $f) { items { id } } }`;
const LEADS = `query($f: CommercialLeadFilter) { commercialLeads(filter: $f) { items { id } } }`;
const ASSIGNEES = `query { commercialAssignees { id } }`;
const REOPEN = `mutation($id: UUID!) { reopenCommercialDeal(id: $id) { errors { code } } }`;
const DELETE = `mutation($id: UUID!) { deleteCommercialDeal(id: $id) { ok } }`;
const ASSIGN = `mutation($id: UUID!, $a: UUID) { assignCommercialDeal(id: $id, assigneeMemberId: $a) { errors { code } } }`;
const WIN = `mutation($i: WinCommercialDealInput!) {
  winCommercialDeal(input: $i) { contractId errors { code field } }
}`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
const code = (res: { errors?: GqlErrors }) => res.errors?.[0]?.extensions?.code;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ids = (r: any, key: string) => (r.data[key].items as { id: string }[]).map((i) => i.id);

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const MODAL = {
  cpf: COMPLETE_CLIENT.cpf,
  rg: COMPLETE_CLIENT.rg,
  postalCode: COMPLETE_CLIENT.postalCode,
  address: COMPLETE_CLIENT.address,
  phone2: COMPLETE_CLIENT.phone2,
};

describe('10 — Comercial para quem ganhou item', () => {
  let w: Phase10World;
  let dealA: string;
  let dealB: string;
  let leadA: string;
  let leadB: string;

  beforeAll(async () => {
    w = await createPhase10World('p10com');
    leadA = await insertLeadRow(w, { createdBy: w.members.attendant });
    leadB = await insertLeadRow(w, { createdBy: w.attendantB.memberId });
    dealA = await insertDealRow(w, { leadId: leadA, assignee: w.members.attendant });
    dealB = await insertDealRow(w, { leadId: leadB, assignee: w.attendantB.memberId });
  });
  afterAll(async () => {
    await destroyPhase10World(w);
  });
  afterEach(async () => {
    await clearOverrides(w);
  });

  it('atendente com Relatórios ganho: relatório vê todas; Pipeline segue só as dela; sem gestão', async () => {
    await setOverrideRow(w, w.members.attendant, 'comercial-relatorios', true);
    const asAtt = gqlAs(w, w.tokens.attendant);
    const filter = {
      from: ymd(new Date(Date.now() - 20 * 86_400_000)),
      to: ymd(new Date(Date.now() + 2 * 86_400_000)),
    };
    const rep = await asAtt(REPORT, { f: filter });
    expect(rep.errors).toBeUndefined();
    const reportIds = rep.data.commercialReport.rows.map((r: any) => r.dealId);
    expect(reportIds).toEqual(expect.arrayContaining([dealA, dealB]));

    expect(ids(await asAtt(DEALS), 'commercialDeals')).toEqual([dealA]);
    expect(ids(await asAtt(LEADS), 'commercialLeads')).toEqual([leadA]);

    expect(code(await asAtt(REOPEN, { id: dealB }))).toBe('ACCESS_DENIED');
    expect(code(await asAtt(DELETE, { id: dealA }))).toBe('ACCESS_DENIED');
    expect(code(await asAtt(ASSIGN, { id: dealA, a: w.attendantB.memberId }))).toBe(
      'ACCESS_DENIED',
    );
  });

  it('atendente sem ganho: só os dela (fase 9 mantida)', async () => {
    const asAtt = gqlAs(w, w.tokens.attendant);
    expect(ids(await asAtt(DEALS), 'commercialDeals')).toEqual([dealA]);
    expect(ids(await asAtt(LEADS), 'commercialLeads')).toEqual([leadA]);
  });

  it('profissional com Leads e Pipeline ganhos: vê todos, é responsável elegível e marca ganho', async () => {
    await setOverrideRow(w, w.members.proA, 'comercial-leads', true);
    await setOverrideRow(w, w.members.proA, 'comercial-pipeline', true);
    const asPro = gqlAs(w, w.tokens.proA);

    expect(ids(await asPro(LEADS), 'commercialLeads')).toEqual(
      expect.arrayContaining([leadA, leadB]),
    );
    expect(ids(await asPro(DEALS), 'commercialDeals')).toEqual(
      expect.arrayContaining([dealA, dealB]),
    );
    const asg = (await asPro(ASSIGNEES)).data.commercialAssignees.map((m: any) => m.id);
    expect(asg).toContain(w.members.proA);

    const lead = await insertLeadRow(w, { fullName: 'Lead Ganho P10' });
    const deal = await insertDealRow(w, {
      leadId: lead,
      assignee: w.members.attendant,
      eventDate: ymd(new Date(Date.now() + 90 * 86_400_000)),
    });
    const res = await asPro(WIN, { i: { dealId: deal, client: MODAL, depositPaid: false } });
    expect(res.errors).toBeUndefined();
    expect(res.data.winCommercialDeal.errors).toEqual([]);
  });

  it('gerente sem Leads e Pipeline: não é responsável elegível e Leads é negado', async () => {
    await setOverrideRow(w, w.members.manager, 'comercial-leads', false);
    await setOverrideRow(w, w.members.manager, 'comercial-pipeline', false);
    const asMgr = gqlAs(w, w.tokens.manager);
    expect(code(await asMgr(LEADS))).toBe('ACCESS_DENIED');

    const asAdmin = gqlAs(w, w.tokens.admin);
    const r = await asAdmin(ASSIGNEES);
    const list: { id: string }[] = r.data.commercialAssignees;
    const got = list.map((m) => m.id);
    expect(got).not.toContain(w.members.manager);
    expect(got).toContain(w.members.admin);
    expect(got).toContain(w.members.attendant);
  });
});
