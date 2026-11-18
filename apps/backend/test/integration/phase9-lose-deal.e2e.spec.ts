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

const FIELDS = `id status lostReasonCode lostReasonText closedAt stage { name kind }`;
const LOSE = `mutation($id: UUID!, $c: String!, $t: String) {
  loseCommercialDeal(id: $id, reasonCode: $c, reasonText: $t) {
    deal { ${FIELDS} } errors { code field }
  }
}`;
const REOPEN = `mutation($id: UUID!, $s: UUID) {
  reopenCommercialDeal(id: $id, stageId: $s) { deal { ${FIELDS} } errors { code } }
}`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}
type Gql = (q: string, v?: Record<string, unknown>) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('fase 9 — perdido e reabertura (D-10, D-19)', () => {
  let w: Phase9World;
  let asManager: Gql;
  let asAttendant: Gql;
  let asAttendantB: Gql;
  let leadId: string;

  beforeAll(async () => {
    w = await createPhase9World('p9lose');
    asManager = gqlAs(w, w.tokens.manager);
    asAttendant = gqlAs(w, w.tokens.attendant);
    asAttendantB = gqlAs(w, w.attendantB.token);
    leadId = await insertLeadRow(w);
  });

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  it('exige motivo da lista; "other" exige texto; texto até 500', async () => {
    const id = await insertDealRow(w, { leadId, assignee: w.members.attendant });
    const bad = await asAttendant(LOSE, { id, c: 'porque_sim' });
    expect(bad.data.loseCommercialDeal.errors[0].code).toBe('LOST_REASON_REQUIRED');
    const other = await asAttendant(LOSE, { id, c: 'other', t: '   ' });
    expect(other.data.loseCommercialDeal.errors[0].code).toBe('LOST_REASON_REQUIRED');
    const long = await asAttendant(LOSE, { id, c: 'price', t: 'x'.repeat(501) });
    expect(long.data.loseCommercialDeal.errors[0].code).toBe('LOST_REASON_TOO_LONG');
    const still = await adminPrisma.commercialDeal.findUniqueOrThrow({ where: { id } });
    expect(still.status).toBe('open');
  });

  it('perder manda para a etapa Perdido, grava motivo e closedAt', async () => {
    const id = await insertDealRow(w, { leadId, assignee: w.members.attendant });
    const r = await asAttendant(LOSE, { id, c: 'price', t: 'Achou caro' });
    const deal = r.data.loseCommercialDeal.deal;
    expect(r.data.loseCommercialDeal.errors).toEqual([]);
    expect(deal.status).toBe('lost');
    expect(deal.stage.kind).toBe('lost');
    expect(deal.lostReasonCode).toBe('price');
    expect(deal.lostReasonText).toBe('Achou caro');
    expect(deal.closedAt).not.toBeNull();
    const row = await adminPrisma.commercialDeal.findUniqueOrThrow({ where: { id } });
    expect(row.stageId).toBe(await stageIdOf(w.orgId, 'lost'));
  });

  it('negócio ganho ou já perdido é DEAL_CLOSED; negócio de outra atendente é NOT_FOUND', async () => {
    const won = await insertDealRow(w, { leadId, status: 'won' });
    const r = await asManager(LOSE, { id: won, c: 'price' });
    expect(r.data.loseCommercialDeal.errors[0].code).toBe('DEAL_CLOSED');
    const mineB = await insertDealRow(w, { leadId, assignee: w.attendantB.memberId });
    const nf = await asAttendant(LOSE, { id: mineB, c: 'price' });
    expect(nf.data.loseCommercialDeal.errors[0].code).toBe('NOT_FOUND');
    const ok = await asAttendantB(LOSE, { id: mineB, c: 'gave_up' });
    expect(ok.data.loseCommercialDeal.deal.status).toBe('lost');
  });

  it('reopenCommercialDeal: MANAGER reabre limpando o motivo (D-19); ATTENDANT é FORBIDDEN', async () => {
    const id = await insertDealRow(w, { leadId, assignee: w.members.attendant });
    await asAttendant(LOSE, { id, c: 'chose_other' });
    expect(isForbidden(await asAttendant(REOPEN, { id }))).toBe(true);

    const prop = await stageIdOf(w.orgId, 'Proposta');
    const r = await asManager(REOPEN, { id, s: prop });
    const deal = r.data.reopenCommercialDeal.deal;
    expect(deal.status).toBe('open');
    expect(deal.stage.name).toBe('Proposta');
    expect(deal.lostReasonCode).toBeNull();
    expect(deal.lostReasonText).toBeNull();
    expect(deal.closedAt).toBeNull();

    const again = await asManager(REOPEN, { id });
    expect(again.data.reopenCommercialDeal.errors[0].code).toBe('DEAL_NOT_LOST');
  });

  it('reabrir sem etapa vai para a primeira aberta; etapa Ganho/Perdido é STAGE_SYSTEM', async () => {
    const id = await insertDealRow(w, { leadId, status: 'lost' });
    const sys = await asManager(REOPEN, { id, s: await stageIdOf(w.orgId, 'won') });
    expect(sys.data.reopenCommercialDeal.errors[0].code).toBe('STAGE_SYSTEM');
    const r = await asManager(REOPEN, { id });
    expect(r.data.reopenCommercialDeal.deal.stage.name).toBe('Novo');
  });
});
