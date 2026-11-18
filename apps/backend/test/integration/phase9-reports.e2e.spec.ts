import ExcelJS from 'exceljs';
import { adminPrisma } from './setup';
import {
  createPhase9World,
  destroyPhase9World,
  gqlAs,
  insertDealRow,
  insertLeadRow,
  stageIdOf,
  type Phase9World,
} from './helpers/phase9-fixtures';

const DASH = `query($p: Int) {
  commercialDashboard(periodDays: $p) {
    periodDays newLeadsToday newDealsToday interactionsToday remindersOverdue remindersToday
    followUpsPending followUps { dealId leadName kind stageName stageColor overdueSince assigneeName }
    lastInteractions { id leadName type occurredAt createdByName }
    stages { stageId name kind count amount }
    openAmount wonCount wonAmount lostCount conversionRate
  }
}`;
const REPORT = `query($f: CommercialReportFilter!) {
  commercialReport(filter: $f) {
    truncated
    totals { deals open won lost openAmount wonAmount conversionRate }
    byStage { name count amount }
    byAssignee { memberId name deals won lost wonAmount }
    bySource { source label deals won }
    lostReasons { code label count }
    rows { dealId leadName kind status stageName assigneeName source finalAmount lostReasonLabel createdAt }
  }
}`;
const EXPORT = `query($f: CommercialReportFilter!, $fmt: String!) {
  exportCommercialReport(filter: $f, format: $fmt) { filename mimeType base64 }
}`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}

type Gql = (q: string, v?: Record<string, unknown>) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

describe('fase 9 - painel, relatórios e exportação', () => {
  let w: Phase9World;
  let asManager: Gql;
  let asAdmin: Gql;
  let asAttendant: Gql;
  let asPro: Gql;
  const id: Record<string, string> = {};
  const wideFilter = () => ({
    from: ymd(new Date(Date.now() - 20 * DAY)),
    to: ymd(new Date(Date.now() + 2 * DAY)),
  });

  async function setDeal(dealId: string, data: Record<string, unknown>) {
    await adminPrisma.commercialDeal.update({ where: { id: dealId }, data });
  }

  beforeAll(async () => {
    w = await createPhase9World('p9rep');
    asManager = gqlAs(w, w.tokens.manager);
    asAdmin = gqlAs(w, w.tokens.admin);
    asAttendant = gqlAs(w, w.tokens.attendant);
    asPro = gqlAs(w, w.tokens.proA);

    const a = w.members.attendant;
    const b = w.attendantB.memberId;
    const now = Date.now();

    // 3 abertos: 2 da atendente (um atrasado) e 1 da B (atrasado, mais recente que o primeiro)
    const l1 = await insertLeadRow(w, { fullName: 'Lead A1', createdBy: a, source: 'instagram' });
    id.a1 = await insertDealRow(w, {
      leadId: l1,
      assignee: a,
      stageName: 'Novo',
      stageEnteredAt: new Date(now - 10 * DAY),
    });
    await setDeal(id.a1, { finalAmount: '100.00', source: 'instagram' });

    const l2 = await insertLeadRow(w, { fullName: 'Lead A2', createdBy: a });
    id.a2 = await insertDealRow(w, { leadId: l2, assignee: a, stageName: 'Contato' });
    await setDeal(id.a2, { finalAmount: '250.00', kind: 'debutante', source: 'indicacao' });

    const l3 = await insertLeadRow(w, { fullName: 'Lead B1' });
    id.b1 = await insertDealRow(w, {
      leadId: l3,
      assignee: b,
      stageName: 'Proposta',
      stageEnteredAt: new Date(now - 6 * DAY),
    });
    await setDeal(id.b1, { finalAmount: '400.00', source: 'site' });

    // ganho e perdido da B (a atendente A não fechou nenhum)
    const l4 = await insertLeadRow(w, { fullName: 'Lead Ganho' });
    id.won = await insertDealRow(w, { leadId: l4, assignee: b, status: 'won' });
    await setDeal(id.won, { finalAmount: '1000.00', source: 'instagram' });
    const l5 = await insertLeadRow(w, { fullName: 'Lead Perdido' });
    id.lost = await insertDealRow(w, { leadId: l5, assignee: b, status: 'lost' });
    await setDeal(id.lost, { finalAmount: '300.00', source: 'site', lostReasonText: 'Achou caro' });

    // negócio excluído: não entra em nada
    const l6 = await insertLeadRow(w, { fullName: 'Lead Excluído' });
    id.del = await insertDealRow(w, {
      leadId: l6,
      assignee: a,
      stageEnteredAt: new Date(now - 30 * DAY),
    });
    await setDeal(id.del, { finalAmount: '9999.00', deletedAt: new Date() });

    // lembretes: vencido e de hoje no negócio da A; vencido no da B; um concluído
    const mk = (dealId: string, title: string, dueAt: Date, completedAt: Date | null = null) =>
      adminPrisma.commercialReminder.create({
        data: {
          organizationId: w.orgId,
          dealId,
          title,
          dueAt,
          completedAt,
          createdBy: w.members.manager,
        },
      });
    await mk(id.a1, 'venceu A', new Date(now - 3_600_000));
    await mk(id.a1, 'hoje A', new Date(now + 5 * 60_000));
    await mk(id.b1, 'venceu B', new Date(now - 7_200_000));
    await mk(id.b1, 'feito B', new Date(now - 7_200_000), new Date());

    // interações
    await adminPrisma.commercialInteraction.create({
      data: {
        organizationId: w.orgId,
        leadId: l1,
        dealId: id.a1,
        type: 'call',
        createdBy: a,
        occurredAt: new Date(),
      },
    });
    await adminPrisma.commercialInteraction.create({
      data: {
        organizationId: w.orgId,
        leadId: l3,
        dealId: id.b1,
        type: 'whatsapp',
        createdBy: b,
        occurredAt: new Date(now - 1000),
      },
    });
  }, 120_000);

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  it('MANAGER vê tudo: openAmount, ganho/perdido e conversão 0.5', async () => {
    const d = (await asManager(DASH)).data.commercialDashboard;
    expect(d.periodDays).toBe(30);
    expect(d.openAmount).toBe('750.00');
    expect(d.wonCount).toBe(1);
    expect(d.wonAmount).toBe('1000.00');
    expect(d.lostCount).toBe(1);
    expect(d.conversionRate).toBe(0.5);
    expect(d.newDealsToday).toBe(5); // o excluído não conta
    expect(d.interactionsToday).toBe(2);
    expect(d.lastInteractions).toHaveLength(2);
    const byName = Object.fromEntries(
      d.stages.map((s: { name: string; count: number; amount: string }) => [s.name, s]),
    );
    expect(byName['Novo'].count).toBe(1);
    expect(byName['Novo'].amount).toBe('100.00');
    expect(byName['Ganho'].amount).toBe('1000.00');
    expect(byName['Perdido'].count).toBe(1);
  });

  it('ATTENDANT vê só os 2 dela e conversão null', async () => {
    const d = (await asAttendant(DASH)).data.commercialDashboard;
    expect(d.openAmount).toBe('350.00');
    expect(d.wonCount).toBe(0);
    expect(d.lostCount).toBe(0);
    expect(d.conversionRate).toBeNull();
    expect(d.newDealsToday).toBe(2);
    expect(d.interactionsToday).toBe(1);
    expect(d.followUpsPending).toBe(1);
  });

  it('follow-ups: SLA estourado, mais atrasado primeiro', async () => {
    const d = (await asManager(DASH)).data.commercialDashboard;
    expect(d.followUpsPending).toBe(2);
    expect(d.followUps.map((f: { dealId: string }) => f.dealId)).toEqual([id.a1, id.b1]);
    expect(d.followUps[0].leadName).toBe('Lead A1');
    expect(d.followUps[0].stageName).toBe('Novo');
    expect(new Date(d.followUps[0].overdueSince).getTime()).toBeLessThan(Date.now());
  });

  it('lembretes vencidos e de hoje respeitam a visibilidade', async () => {
    const m = (await asManager(DASH)).data.commercialDashboard;
    expect(m.remindersOverdue).toBe(2);
    expect(m.remindersToday).toBe(1);
    const a = (await asAttendant(DASH)).data.commercialDashboard;
    expect(a.remindersOverdue).toBe(1);
    expect(a.remindersToday).toBe(1);
  });

  it('"hoje" é o dia local da organização (America/Sao_Paulo)', async () => {
    const [{ start }] = await adminPrisma.$queryRaw<{ start: Date }[]>`
      SELECT (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') AS start`;
    const before = (await asManager(DASH)).data.commercialDashboard.newLeadsToday as number;
    for (const [name, at] of [
      ['Ontem 23h59', new Date(start.getTime() - 60_000)],
      ['Hoje 00h01', new Date(start.getTime() + 60_000)],
    ] as const) {
      const lead = await insertLeadRow(w, { fullName: name });
      await adminPrisma.commercialLead.update({ where: { id: lead }, data: { createdAt: at } });
    }
    const after = (await asManager(DASH)).data.commercialDashboard.newLeadsToday as number;
    // só o lead de 00h01 (se o teste rodar depois dessa hora) entra em "hoje"
    expect(after - before).toBe(Date.now() > start.getTime() + 60_000 ? 1 : 0);
  });

  it('commercialReport: totais, por etapa/responsável/origem e motivos de perda', async () => {
    const res = await asManager(REPORT, { f: wideFilter() });
    const r = res.data.commercialReport;
    expect(r.truncated).toBe(false);
    expect(r.totals).toMatchObject({
      deals: 5,
      open: 3,
      won: 1,
      lost: 1,
      openAmount: '750.00',
      wonAmount: '1000.00',
      conversionRate: 0.5,
    });
    expect(r.rows).toHaveLength(5);
    expect(r.rows.map((x: { leadName: string }) => x.leadName)).not.toContain('Lead Excluído');
    const stageNovo = r.byStage.find((s: { name: string }) => s.name === 'Novo');
    expect(stageNovo).toMatchObject({ count: 1, amount: '100.00' });
    const bAssignee = r.byAssignee.find(
      (x: { memberId: string }) => x.memberId === w.attendantB.memberId,
    );
    expect(bAssignee).toMatchObject({ deals: 3, won: 1, lost: 1, wonAmount: '1000.00' });
    const insta = r.bySource.find((x: { source: string }) => x.source === 'instagram');
    expect(insta).toMatchObject({ label: 'Instagram', deals: 2, won: 1 });
    expect(r.lostReasons).toEqual([{ code: 'other', label: 'Outro', count: 1 }]);
  });

  it('filtros assignee/stage/status/kind/source combinam', async () => {
    const base = wideFilter();
    const q = async (extra: Record<string, unknown>) =>
      (await asAdmin(REPORT, { f: { ...base, ...extra } })).data.commercialReport;

    expect((await q({ assigneeMemberId: w.members.attendant })).totals.deals).toBe(2);
    expect((await q({ status: 'won' })).totals.deals).toBe(1);
    expect((await q({ kind: 'debutante' })).totals.deals).toBe(1);
    expect((await q({ source: 'site' })).totals.deals).toBe(2);
    expect((await q({ stageId: await stageIdOf(w.orgId, 'Novo') })).totals.deals).toBe(1);
    const combo = await q({
      assigneeMemberId: w.attendantB.memberId,
      source: 'site',
      status: 'lost',
    });
    expect(combo.totals.deals).toBe(1);
    expect(combo.rows[0].lostReasonLabel).toBe('Outro');
    expect((await q({ assigneeMemberId: w.members.attendant, status: 'won' })).totals.deals).toBe(
      0,
    );
  });

  it('período usa created_at do negócio no fuso da org e valida entradas', async () => {
    const lead = await insertLeadRow(w, { fullName: 'Lead Antigo' });
    const old = await insertDealRow(w, { leadId: lead, status: 'won' });
    await setDeal(old, {
      createdAt: new Date('2026-01-15T15:00:00Z'),
      closedAt: new Date('2026-01-20T15:00:00Z'),
      finalAmount: '10.00',
    });
    const jan = (await asManager(REPORT, { f: { from: '2026-01-01', to: '2026-01-31' } })).data
      .commercialReport;
    expect(jan.totals.deals).toBe(1);
    expect(jan.rows[0].leadName).toBe('Lead Antigo');
    const cur = (await asManager(REPORT, { f: wideFilter() })).data.commercialReport;
    expect(cur.totals.deals).toBe(5);

    // 15/01 02:30Z ainda é 14/01 em São Paulo
    await setDeal(old, { createdAt: new Date('2026-01-15T02:30:00Z') });
    const d14 = (await asManager(REPORT, { f: { from: '2026-01-14', to: '2026-01-14' } })).data
      .commercialReport;
    expect(d14.totals.deals).toBe(1);
    const d15 = (await asManager(REPORT, { f: { from: '2026-01-15', to: '2026-01-15' } })).data
      .commercialReport;
    expect(d15.totals.deals).toBe(0);

    for (const bad of [
      { from: '2026/01/01', to: '2026-01-31' },
      { from: '2026-02-01', to: '2026-01-31' },
      { from: '2025-01-01', to: '2026-06-01' },
      { from: '2026-02-31', to: '2026-03-01' },
      { ...wideFilter(), status: 'xx' },
      { ...wideFilter(), kind: 'xx' },
      { ...wideFilter(), source: 'xx' },
    ]) {
      const res = await asManager(REPORT, { f: bad });
      expect(res.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    }
    const per = await asManager(REPORT, { f: { from: '2026-02-01', to: '2026-01-31' } });
    expect(per.errors[0].extensions.reason).toBe('PERIOD_INVALID');
  });

  it('exportCommercialReport xlsx traz as mesmas linhas do relatório', async () => {
    const f = wideFilter();
    const rep = (await asManager(REPORT, { f })).data.commercialReport;
    const res = await asManager(EXPORT, { f, fmt: 'xlsx' });
    const file = res.data.exportCommercialReport;
    expect(file.filename).toMatch(/^relatorio-comercial-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(file.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(file.base64, 'base64') as unknown as ArrayBuffer);
    const neg = wb.getWorksheet('Negócios')!;
    expect(neg.rowCount).toBe(rep.rows.length + 1);
    const names: string[] = [];
    neg.eachRow((row, n) => {
      if (n > 1) names.push(String(row.getCell(1).value));
    });
    expect(names.sort()).toEqual(rep.rows.map((r: { leadName: string }) => r.leadName).sort());
    expect(wb.getWorksheet('Resumo')).toBeDefined();
  });

  it('exportCommercialReport pdf e formato inválido', async () => {
    const f = wideFilter();
    const pdf = (await asManager(EXPORT, { f, fmt: 'pdf' })).data.exportCommercialReport;
    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.filename).toMatch(/\.pdf$/);
    expect(Buffer.from(pdf.base64, 'base64').subarray(0, 4).toString()).toBe('%PDF');

    const bad = await asManager(EXPORT, { f, fmt: 'csv' });
    expect(bad.errors[0].extensions.code).toBe('BAD_USER_INPUT');
    expect(bad.errors[0].extensions.reason).toBe('FORMAT_INVALID');
  });

  it('mais de 5.000 linhas: rows com 5.000 e truncated true', async () => {
    const lead = await insertLeadRow(w, { fullName: 'Lead Massa' });
    const stageId = await stageIdOf(w.orgId, 'Novo');
    await adminPrisma.commercialDeal.createMany({
      data: Array.from({ length: 5001 }, () => ({
        organizationId: w.orgId,
        leadId: lead,
        stageId,
        kind: 'noiva',
        createdAt: new Date('2025-06-15T15:00:00Z'),
      })),
    });
    const res = await asManager(REPORT, { f: { from: '2025-06-15', to: '2025-06-15' } });
    const r = res.data.commercialReport;
    expect(r.rows).toHaveLength(5000);
    expect(r.truncated).toBe(true);
    expect(r.totals.deals).toBe(5001);
  }, 120_000);

  it('ATTENDANT: dashboard ok, relatório e exportação FORBIDDEN; PROFESSIONAL: tudo FORBIDDEN', async () => {
    const f = wideFilter();
    expect((await asAttendant(DASH)).errors).toBeUndefined();
    expect(isForbidden(await asAttendant(REPORT, { f }))).toBe(true);
    expect(isForbidden(await asAttendant(EXPORT, { f, fmt: 'xlsx' }))).toBe(true);
    expect(isForbidden(await asPro(DASH))).toBe(true);
    expect(isForbidden(await asPro(REPORT, { f }))).toBe(true);
    expect(isForbidden(await asPro(EXPORT, { f, fmt: 'pdf' }))).toBe(true);
  });
});
