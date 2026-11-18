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

const DEAL_FIELDS = `id leadId status kind beneficiaryName eventDate packageName packagePrice
  discountAmount finalAmount source location notes stageEnteredAt lastInteractionAt overdue
  overdueSince stage { id name kind } assignee { id roleName } package { id name price }
  lead { id fullName }`;
const CREATE = `mutation($i: CreateCommercialDealInput!) {
  createCommercialDeal(input: $i) { deal { ${DEAL_FIELDS} } errors { code field } }
}`;
const UPDATE = `mutation($i: UpdateCommercialDealInput!) {
  updateCommercialDeal(input: $i) { deal { ${DEAL_FIELDS} } errors { code field } }
}`;
const MOVE = `mutation($id: UUID!, $s: UUID!) {
  moveCommercialDeal(id: $id, stageId: $s) { deal { ${DEAL_FIELDS} } errors { code } }
}`;
const ASSIGN = `mutation($id: UUID!, $a: UUID) {
  assignCommercialDeal(id: $id, assigneeMemberId: $a) { deal { ${DEAL_FIELDS} } errors { code } }
}`;
const DELETE = `mutation($id: UUID!) { deleteCommercialDeal(id: $id) { ok errors { code } } }`;
const LIST = `query($f: CommercialDealFilter) {
  commercialDeals(filter: $f) { total items { ${DEAL_FIELDS} } }
}`;
const GET = `query($id: UUID!) { commercialDeal(id: $id) { ${DEAL_FIELDS} } }`;
const LEAD_DEALS = `query($id: UUID!) { commercialLead(id: $id) { id deals { id } } }`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}
type Gql = (q: string, v?: Record<string, unknown>) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const DAY = 86_400_000;

describe('fase 9 — negócios (criar, editar, mover, atribuir, SLA, visibilidade)', () => {
  let w: Phase9World;
  let asManager: Gql;
  let asAttendant: Gql;
  let asAttendantB: Gql;
  let asPro: Gql;
  let leadId: string;

  beforeAll(async () => {
    w = await createPhase9World('p9deals');
    asManager = gqlAs(w, w.tokens.manager);
    asAttendant = gqlAs(w, w.tokens.attendant);
    asAttendantB = gqlAs(w, w.attendantB.token);
    asPro = gqlAs(w, w.tokens.proA);
    leadId = await insertLeadRow(w, { fullName: 'Lead dos negócios' });
  });

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  it('create fotografa pacote e calcula valor final; sem stageId vai à primeira etapa aberta', async () => {
    const r = await asManager(CREATE, {
      i: { leadId, kind: 'noiva', packageId: w.bridalPackageId, discountAmount: '50.00' },
    });
    const deal = r.data.createCommercialDeal.deal;
    expect(r.data.createCommercialDeal.errors).toEqual([]);
    expect(deal.packagePrice).toBe('500.00');
    expect(deal.discountAmount).toBe('50.00');
    expect(deal.finalAmount).toBe('450.00');
    expect(deal.package.id).toBe(w.bridalPackageId);
    expect(deal.stage.name).toBe('Novo');
    expect(deal.status).toBe('open');
    expect(deal.assignee).toBeNull();
    expect(deal.source).toBe('manual');

    // preço do catálogo muda depois: o negócio mantém o valor fotografado
    const pkg = await adminPrisma.package.findUniqueOrThrow({ where: { id: w.bridalPackageId } });
    await adminPrisma.package.update({ where: { id: pkg.id }, data: { price: '999.00' } });
    const again = (await asManager(GET, { id: deal.id })).data.commercialDeal;
    expect(again.packagePrice).toBe('500.00');
    expect(again.finalAmount).toBe('450.00');
    await adminPrisma.package.update({ where: { id: pkg.id }, data: { price: pkg.price } });
  });

  it('create valida desconto, tipo, data, pacote e responsável', async () => {
    const bigDiscount = await asManager(CREATE, {
      i: { leadId, kind: 'noiva', packageId: w.bridalPackageId, discountAmount: '600.00' },
    });
    expect(bigDiscount.data.createCommercialDeal.errors[0].code).toBe('DISCOUNT_INVALID');
    const kind = await asManager(CREATE, { i: { leadId, kind: 'social' } });
    expect(kind.data.createCommercialDeal.errors[0].code).toBe('KIND_INVALID');
    const date = await asManager(CREATE, { i: { leadId, kind: 'noiva', eventDate: '31/12/2027' } });
    expect(date.data.createCommercialDeal.errors[0].code).toBe('EVENT_DATE_INVALID');
    const proAssignee = await asManager(CREATE, {
      i: { leadId, kind: 'noiva', assigneeMemberId: w.members.proA },
    });
    expect(proAssignee.data.createCommercialDeal.errors[0].code).toBe('ASSIGNEE_INVALID');
    const ok = await asManager(CREATE, {
      i: { leadId, kind: 'debutante', eventDate: '2027-03-20', packageId: w.debutantePackageId },
    });
    expect(ok.data.createCommercialDeal.deal.eventDate).toBe('2027-03-20');
    expect(ok.data.createCommercialDeal.deal.finalAmount).toBe('900.00');
  });

  it('ATTENDANT cria como responsável mesmo mandando outro; MANAGER atribui a outra atendente ou a ninguém', async () => {
    const mineLead = await insertLeadRow(w, { createdBy: w.members.attendant });
    const r = await asAttendant(CREATE, {
      i: { leadId: mineLead, kind: 'noiva', assigneeMemberId: w.attendantB.memberId },
    });
    expect(r.data.createCommercialDeal.deal.assignee.id).toBe(w.members.attendant);

    const m1 = await asManager(CREATE, {
      i: { leadId, kind: 'noiva', assigneeMemberId: w.attendantB.memberId },
    });
    expect(m1.data.createCommercialDeal.deal.assignee.id).toBe(w.attendantB.memberId);
    const m2 = await asManager(CREATE, { i: { leadId, kind: 'noiva' } });
    expect(m2.data.createCommercialDeal.deal.assignee).toBeNull();
  });

  it('ATTENDANT não cria negócio em lead que não vê', async () => {
    const theirs = await insertLeadRow(w, { createdBy: w.attendantB.memberId });
    const r = await asAttendant(CREATE, { i: { leadId: theirs, kind: 'noiva' } });
    expect(r.data.createCommercialDeal.errors[0].code).toBe('NOT_FOUND');
  });

  it('assign: MANAGER troca para atendente, profissional é ASSIGNEE_INVALID, ATTENDANT é FORBIDDEN', async () => {
    const id = await insertDealRow(w, { leadId, assignee: w.members.attendant });
    const ok = await asManager(ASSIGN, { id, a: w.attendantB.memberId });
    expect(ok.data.assignCommercialDeal.deal.assignee.id).toBe(w.attendantB.memberId);
    const bad = await asManager(ASSIGN, { id, a: w.members.proA });
    expect(bad.data.assignCommercialDeal.errors[0].code).toBe('ASSIGNEE_INVALID');
    const none = await asManager(ASSIGN, { id, a: null });
    expect(none.data.assignCommercialDeal.deal.assignee).toBeNull();
    const att = await asAttendant(ASSIGN, { id, a: w.members.attendant });
    expect(isForbidden(att)).toBe(true);
  });

  it('update recalcula o valor final e troca de pacote; negócio fechado é DEAL_CLOSED', async () => {
    const created = await asManager(CREATE, {
      i: { leadId, kind: 'noiva', packageId: w.bridalPackageId, discountAmount: '100' },
    });
    const id = created.data.createCommercialDeal.deal.id;
    expect(created.data.createCommercialDeal.deal.finalAmount).toBe('400.00');
    const up = await asManager(UPDATE, {
      i: { id, discountAmount: '0,50', notes: 'obs', location: 'Salão' },
    });
    expect(up.data.updateCommercialDeal.deal.finalAmount).toBe('499.50');
    expect(up.data.updateCommercialDeal.deal.notes).toBe('obs');
    const swap = await asManager(UPDATE, { i: { id, packageId: w.debutantePackageId } });
    expect(swap.data.updateCommercialDeal.deal.packagePrice).toBe('900.00');
    expect(swap.data.updateCommercialDeal.deal.finalAmount).toBe('899.50');
    const clear = await asManager(UPDATE, { i: { id, packageId: null, discountAmount: '0' } });
    expect(clear.data.updateCommercialDeal.deal.package).toBeNull();
    expect(clear.data.updateCommercialDeal.deal.finalAmount).toBeNull();

    const lost = await insertDealRow(w, { leadId, status: 'lost' });
    const closed = await asManager(UPDATE, { i: { id: lost, notes: 'x' } });
    expect(closed.data.updateCommercialDeal.errors[0].code).toBe('DEAL_CLOSED');
  });

  it('move: etapa aberta atualiza stageEnteredAt; Ganho/Perdido é STAGE_SYSTEM; fechado é DEAL_CLOSED', async () => {
    const old = new Date(Date.now() - 5 * DAY);
    const id = await insertDealRow(w, { leadId, stageEnteredAt: old });
    const prop = await stageIdOf(w.orgId, 'Proposta');
    const r = await asManager(MOVE, { id, s: prop });
    const deal = r.data.moveCommercialDeal.deal;
    expect(deal.stage.name).toBe('Proposta');
    expect(new Date(deal.stageEnteredAt).getTime()).toBeGreaterThan(old.getTime() + 4 * DAY);

    const won = await asManager(MOVE, { id, s: await stageIdOf(w.orgId, 'won') });
    expect(won.data.moveCommercialDeal.errors[0].code).toBe('STAGE_SYSTEM');
    const lostStage = await asManager(MOVE, { id, s: await stageIdOf(w.orgId, 'lost') });
    expect(lostStage.data.moveCommercialDeal.errors[0].code).toBe('STAGE_SYSTEM');

    const closedId = await insertDealRow(w, { leadId, status: 'won' });
    const closed = await asManager(MOVE, { id: closedId, s: prop });
    expect(closed.data.moveCommercialDeal.errors[0].code).toBe('DEAL_CLOSED');

    const otherOrgStage = await stageIdOf(w.otherOrgId, 'Proposta');
    const alien = await asManager(MOVE, { id, s: otherOrgStage });
    expect(alien.data.moveCommercialDeal.errors[0].code).toBe('NOT_FOUND');
  });

  it('listagem do kanban: abertos + fechados recentes; filtros e visibilidade por papel', async () => {
    const l = await insertLeadRow(w, { fullName: 'Kanban' });
    const open = await insertDealRow(w, { leadId: l, assignee: w.members.attendant });
    const openB = await insertDealRow(w, { leadId: l, assignee: w.attendantB.memberId });
    const unassigned = await insertDealRow(w, { leadId: l });
    const wonRecent = await insertDealRow(w, { leadId: l, status: 'won' });
    const lostOld = await insertDealRow(w, { leadId: l, status: 'lost' });
    await adminPrisma.commercialDeal.update({
      where: { id: lostOld },
      data: { closedAt: new Date(Date.now() - 60 * DAY) },
    });

    const mgr = await asManager(LIST, { f: { leadId: l } });
    const ids = (r: { data: any }) => r.data.commercialDeals.items.map((d: any) => d.id); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(ids(mgr).sort()).toEqual([open, openB, unassigned, wonRecent].sort());
    expect(ids(await asManager(LIST, { f: { leadId: l, closedSinceDays: 90 } })).sort()).toEqual(
      [open, openB, unassigned, wonRecent, lostOld].sort(),
    );
    expect(ids(await asManager(LIST, { f: { leadId: l, status: 'lost' } }))).toEqual([lostOld]);
    expect(ids(await asManager(LIST, { f: { leadId: l, unassigned: true } }))).toEqual([
      unassigned,
    ]);
    expect(
      ids(await asManager(LIST, { f: { leadId: l, assigneeMemberId: w.attendantB.memberId } })),
    ).toEqual([openB]);

    // atendente A: só os dela (aberto); o ganho/sem responsável/de B ficam de fora
    const a = await asAttendant(LIST, { f: { leadId: l } });
    expect(ids(a)).toEqual([open]);
    const b = await asAttendantB(LIST, { f: { leadId: l } });
    expect(ids(b)).toEqual([openB]);

    expect((await asAttendant(GET, { id: openB })).data.commercialDeal).toBeNull();
    expect((await asAttendant(GET, { id: unassigned })).data.commercialDeal).toBeNull();
    expect((await asAttendant(GET, { id: open })).data.commercialDeal.id).toBe(open);

    const upd = await asAttendant(UPDATE, { i: { id: openB, notes: 'invadindo' } });
    expect(upd.data.updateCommercialDeal.errors[0].code).toBe('NOT_FOUND');
    const mv = await asAttendant(MOVE, { id: openB, s: await stageIdOf(w.orgId, 'Contato') });
    expect(mv.data.moveCommercialDeal.errors[0].code).toBe('NOT_FOUND');
  });

  it('overdue segue o SLA da etapa (Contato = 3 dias)', async () => {
    const l = await insertLeadRow(w);
    const late = await insertDealRow(w, {
      leadId: l,
      stageName: 'Contato',
      stageEnteredAt: new Date(Date.now() - 4 * DAY),
    });
    const fresh = await insertDealRow(w, {
      leadId: l,
      stageName: 'Contato',
      stageEnteredAt: new Date(Date.now() - 4 * DAY),
      lastInteractionAt: new Date(Date.now() - 1 * DAY),
    });
    const won = await insertDealRow(w, { leadId: l, status: 'won' });
    const lateRes = (await asManager(GET, { id: late })).data.commercialDeal;
    expect(lateRes.overdue).toBe(true);
    expect(lateRes.overdueSince).not.toBeNull();
    const freshRes = (await asManager(GET, { id: fresh })).data.commercialDeal;
    expect(freshRes.overdue).toBe(false);
    const wonRes = (await asManager(GET, { id: won })).data.commercialDeal;
    expect(wonRes.overdue).toBe(false);
    expect(wonRes.overdueSince).toBeNull();
  });

  it('lead.deals lista só os negócios visíveis', async () => {
    const l = await insertLeadRow(w);
    const mine = await insertDealRow(w, { leadId: l, assignee: w.members.attendant });
    await insertDealRow(w, { leadId: l, assignee: w.attendantB.memberId });
    const asMgr = await asManager(LEAD_DEALS, { id: l });
    expect(asMgr.data.commercialLead.deals).toHaveLength(2);
    const asA = await asAttendant(LEAD_DEALS, { id: l });
    expect(asA.data.commercialLead.deals.map((d: { id: string }) => d.id)).toEqual([mine]);
  });

  it('delete: MANAGER marca deleted_at; ATTENDANT é FORBIDDEN; some das consultas', async () => {
    const id = await insertDealRow(w, { leadId, assignee: w.members.attendant });
    expect(isForbidden(await asAttendant(DELETE, { id }))).toBe(true);
    const r = await asManager(DELETE, { id });
    expect(r.data.deleteCommercialDeal.ok).toBe(true);
    const row = await adminPrisma.commercialDeal.findUniqueOrThrow({ where: { id } });
    expect(row.deletedAt).not.toBeNull();
    expect((await asManager(GET, { id })).data.commercialDeal).toBeNull();
  });

  it('PROFESSIONAL é FORBIDDEN em leitura e criação', async () => {
    expect(isForbidden(await asPro(LIST, {}))).toBe(true);
    expect(isForbidden(await asPro(CREATE, { i: { leadId, kind: 'noiva' } }))).toBe(true);
  });
});
