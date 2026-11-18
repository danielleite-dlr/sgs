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

const STAGES = `query { commercialStages { id name color position slaDays kind isSystem openDeals } }`;
const CREATE = `mutation($i: CommercialStageInput!) {
  createCommercialStage(input: $i) { stage { id name color position slaDays kind } errors { code field } }
}`;
const UPDATE = `mutation($id: UUID!, $i: CommercialStageInput!) {
  updateCommercialStage(id: $id, input: $i) { stage { id name color slaDays kind } errors { code field } }
}`;
const REORDER = `mutation($ids: [UUID!]!) {
  reorderCommercialStages(ids: $ids) { stages { id name position kind } errors { code } }
}`;
const DELETE = `mutation($id: UUID!, $to: UUID) {
  deleteCommercialStage(id: $id, moveToStageId: $to) { ok errors { code } }
}`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}

describe('fase 9 — etapas do funil', () => {
  let w: Phase9World;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let asManager: (q: string, v?: Record<string, unknown>) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let asAttendant: (q: string, v?: Record<string, unknown>) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let asPro: (q: string, v?: Record<string, unknown>) => Promise<any>;

  beforeAll(async () => {
    w = await createPhase9World('p9stages');
    asManager = gqlAs(w, w.tokens.manager);
    asAttendant = gqlAs(w, w.tokens.attendant);
    asPro = gqlAs(w, w.tokens.proA);
  });

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  it('org sem etapas ganha as 6 padrão no primeiro acesso, sem duplicar em paralelo', async () => {
    await adminPrisma.commercialStage.deleteMany({ where: { organizationId: w.orgId } });
    const [a, b] = await Promise.all([asManager(STAGES), asManager(STAGES)]);
    expect(a.errors).toBeUndefined();
    expect(b.errors).toBeUndefined();
    const names = a.data.commercialStages.map((s: { name: string }) => s.name);
    expect(names).toEqual(['Novo', 'Contato', 'Proposta', 'Negociação', 'Ganho', 'Perdido']);
    expect(await adminPrisma.commercialStage.count({ where: { organizationId: w.orgId } })).toBe(6);
  });

  it('create cria etapa aberta antes de Ganho; validações de nome, cor e prazo', async () => {
    const r = await asManager(CREATE, { i: { name: '  Visita  ', color: '#112233', slaDays: 5 } });
    const st = r.data.createCommercialStage.stage;
    expect(st.name).toBe('Visita');
    expect(st.kind).toBe('open');
    expect(st.slaDays).toBe(5);
    const list = (await asManager(STAGES)).data.commercialStages;
    expect(list.map((s: { name: string }) => s.name)).toEqual([
      'Novo',
      'Contato',
      'Proposta',
      'Negociação',
      'Visita',
      'Ganho',
      'Perdido',
    ]);
    const bad = await asManager(CREATE, { i: { name: 'X', color: 'azul' } });
    expect(bad.data.createCommercialStage.errors[0].code).toBe('COLOR_INVALID');
    const noName = await asManager(CREATE, { i: { name: '   ', color: '#112233' } });
    expect(noName.data.createCommercialStage.errors[0].code).toBe('NAME_REQUIRED');
    const sla = await asManager(CREATE, { i: { name: 'Y', color: '#112233', slaDays: 0 } });
    expect(sla.data.createCommercialStage.errors[0].code).toBe('SLA_INVALID');
  });

  it('update altera nome, cor e prazo; em Ganho ignora o prazo', async () => {
    const id = await stageIdOf(w.orgId, 'Contato');
    const r = await asManager(UPDATE, {
      id,
      i: { name: 'Primeiro contato', color: '#00FF00', slaDays: 7 },
    });
    expect(r.data.updateCommercialStage.stage).toMatchObject({
      name: 'Primeiro contato',
      color: '#00FF00',
      slaDays: 7,
    });
    const won = await stageIdOf(w.orgId, 'won');
    const rw = await asManager(UPDATE, {
      id: won,
      i: { name: 'Fechado', color: '#00AA00', slaDays: 4 },
    });
    expect(rw.data.updateCommercialStage.stage).toMatchObject({
      name: 'Fechado',
      slaDays: null,
      kind: 'won',
    });
    const bad = await asManager(UPDATE, { id, i: { name: 'a', color: '#12' } });
    expect(bad.data.updateCommercialStage.errors[0].code).toBe('COLOR_INVALID');
  });

  it('reorder: Ganho antes de aberta ou lista incompleta -> STAGE_ORDER; ordem válida grava', async () => {
    const list = (await asManager(STAGES)).data.commercialStages as { id: string; kind: string }[];
    const open = list.filter((s) => s.kind === 'open').map((s) => s.id);
    const won = list.find((s) => s.kind === 'won')!.id;
    const lost = list.find((s) => s.kind === 'lost')!.id;

    const wonFirst = await asManager(REORDER, { ids: [won, ...open, lost] });
    expect(wonFirst.data.reorderCommercialStages.errors[0].code).toBe('STAGE_ORDER');
    const incomplete = await asManager(REORDER, { ids: [...open.slice(1), won, lost] });
    expect(incomplete.data.reorderCommercialStages.errors[0].code).toBe('STAGE_ORDER');
    const lostBeforeWon = await asManager(REORDER, { ids: [...open, lost, won] });
    expect(lostBeforeWon.data.reorderCommercialStages.errors[0].code).toBe('STAGE_ORDER');

    const reversed = [...open].reverse();
    const ok = await asManager(REORDER, { ids: [...reversed, won, lost] });
    expect(ok.data.reorderCommercialStages.errors).toEqual([]);
    const after = (await asManager(STAGES)).data.commercialStages as { id: string }[];
    expect(after.map((s) => s.id)).toEqual([...reversed, won, lost]);
  });

  it('delete: STAGE_SYSTEM, STAGE_NOT_EMPTY, mover negócios e STAGE_LAST_OPEN', async () => {
    const won = await stageIdOf(w.orgId, 'won');
    const lost = await stageIdOf(w.orgId, 'lost');
    expect((await asManager(DELETE, { id: won })).data.deleteCommercialStage.errors[0].code).toBe(
      'STAGE_SYSTEM',
    );
    expect((await asManager(DELETE, { id: lost })).data.deleteCommercialStage.errors[0].code).toBe(
      'STAGE_SYSTEM',
    );

    const proposta = await stageIdOf(w.orgId, 'Proposta');
    const novo = await stageIdOf(w.orgId, 'Novo');
    const leadId = await insertLeadRow(w);
    const dealId = await insertDealRow(w, { leadId, stageName: 'Proposta' });
    const notEmpty = await asManager(DELETE, { id: proposta });
    expect(notEmpty.data.deleteCommercialStage.errors[0].code).toBe('STAGE_NOT_EMPTY');

    const moved = await asManager(DELETE, { id: proposta, to: novo });
    expect(moved.data.deleteCommercialStage).toEqual({ ok: true, errors: [] });
    const deal = await adminPrisma.commercialDeal.findUniqueOrThrow({ where: { id: dealId } });
    expect(deal.stageId).toBe(novo);
    expect(await adminPrisma.commercialStage.count({ where: { id: proposta } })).toBe(0);

    // apaga as abertas restantes (vazias) até sobrar uma
    await adminPrisma.commercialDeal.deleteMany({ where: { id: dealId } });
    const open = await adminPrisma.commercialStage.findMany({
      where: { organizationId: w.orgId, kind: 'open' },
      orderBy: { position: 'asc' },
    });
    for (const s of open.slice(1)) {
      const r = await asManager(DELETE, { id: s.id });
      expect(r.data.deleteCommercialStage.ok).toBe(true);
    }
    const last = await asManager(DELETE, { id: open[0].id });
    expect(last.data.deleteCommercialStage.errors[0].code).toBe('STAGE_LAST_OPEN');
  });

  it('ATTENDANT lê, mas não gerencia; PROFESSIONAL é barrado', async () => {
    expect((await asAttendant(STAGES)).data.commercialStages.length).toBeGreaterThan(0);
    const c = await asAttendant(CREATE, { i: { name: 'Z', color: '#112233' } });
    expect(isForbidden(c)).toBe(true);
    const id = await stageIdOf(w.orgId, 'won');
    expect(isForbidden(await asAttendant(UPDATE, { id, i: { name: 'Z', color: '#112233' } }))).toBe(
      true,
    );
    expect(isForbidden(await asAttendant(REORDER, { ids: [id] }))).toBe(true);
    expect(isForbidden(await asAttendant(DELETE, { id }))).toBe(true);
    expect(isForbidden(await asPro(STAGES))).toBe(true);
  });

  it('openDeals conta só os negócios visíveis ao usuário', async () => {
    const stage = (await asManager(STAGES)).data.commercialStages.find(
      (s: { kind: string }) => s.kind === 'open',
    );
    const novo = stage.id as string;
    const lead = await insertLeadRow(w);
    const before = (await asManager(STAGES)).data.commercialStages.find(
      (s: { id: string }) => s.id === novo,
    ).openDeals;
    const beforeAtt = (await asAttendant(STAGES)).data.commercialStages.find(
      (s: { id: string }) => s.id === novo,
    ).openDeals;
    await adminPrisma.commercialDeal.createMany({
      data: [
        {
          organizationId: w.orgId,
          leadId: lead,
          stageId: novo,
          kind: 'noiva',
          assigneeMemberId: w.members.attendant,
        },
        {
          organizationId: w.orgId,
          leadId: lead,
          stageId: novo,
          kind: 'noiva',
          assigneeMemberId: null,
        },
      ],
    });
    const m = (await asManager(STAGES)).data.commercialStages.find(
      (s: { id: string }) => s.id === novo,
    );
    const a = (await asAttendant(STAGES)).data.commercialStages.find(
      (s: { id: string }) => s.id === novo,
    );
    expect(m.openDeals).toBe(before + 2);
    expect(a.openDeals).toBe(beforeAtt + 1);
  });
});
