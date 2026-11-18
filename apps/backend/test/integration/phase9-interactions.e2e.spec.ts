import { adminPrisma } from './setup';
import {
  createPhase9World,
  destroyPhase9World,
  gqlAs,
  insertDealRow,
  insertLeadRow,
  type Phase9World,
} from './helpers/phase9-fixtures';

const FIELDS = `id leadId dealId type notes occurredAt reminderId createdBy { id }`;
const CREATE = `mutation($i: CreateCommercialInteractionInput!) {
  createCommercialInteraction(input: $i) { interaction { ${FIELDS} } errors { code field } }
}`;
const LIST = `query($l: UUID!, $d: UUID, $n: Int) {
  commercialInteractions(leadId: $l, dealId: $d, limit: $n) { ${FIELDS} }
}`;
const DELETE = `mutation($id: UUID!) { deleteCommercialInteraction(id: $id) { ok errors { code } } }`;
const LEAD_INTER = `query($id: UUID!) { commercialLead(id: $id) { interactions(limit: 2) { id } } }`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}
type Gql = (q: string, v?: Record<string, unknown>) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe('fase 9 — interações e próximo contato', () => {
  let w: Phase9World;
  let asManager: Gql;
  let asAttendant: Gql;
  let asPro: Gql;

  beforeAll(async () => {
    w = await createPhase9World('p9inter');
    asManager = gqlAs(w, w.tokens.manager);
    asAttendant = gqlAs(w, w.tokens.attendant);
    asPro = gqlAs(w, w.tokens.proA);
  });

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  const lastAt = async (id: string) =>
    (await adminPrisma.commercialDeal.findUniqueOrThrow({ where: { id } })).lastInteractionAt;

  it('com dealId grava a interação e atualiza lastInteractionAt; valida tipo, notas e data futura', async () => {
    const leadId = await insertLeadRow(w);
    const dealId = await insertDealRow(w, { leadId });
    const at = new Date(Date.now() - 2 * HOUR);
    const r = await asManager(CREATE, {
      i: { leadId, dealId, type: 'whatsapp', notes: 'falei', occurredAt: at.toISOString() },
    });
    expect(r.data.createCommercialInteraction.errors).toEqual([]);
    const it1 = r.data.createCommercialInteraction.interaction;
    expect(it1.dealId).toBe(dealId);
    expect(it1.createdBy.id).toBe(w.members.manager);
    expect((await lastAt(dealId))?.getTime()).toBe(at.getTime());

    const t = await asManager(CREATE, { i: { leadId, dealId, type: 'sms' } });
    expect(t.data.createCommercialInteraction.errors[0].code).toBe('TYPE_INVALID');
    const n = await asManager(CREATE, {
      i: { leadId, dealId, type: 'call', notes: 'x'.repeat(2001) },
    });
    expect(n.data.createCommercialInteraction.errors[0].code).toBe('NOTES_TOO_LONG');
    const f = await asManager(CREATE, {
      i: { leadId, dealId, type: 'call', occurredAt: new Date(Date.now() + HOUR).toISOString() },
    });
    expect(f.data.createCommercialInteraction.errors[0].code).toBe('OCCURRED_IN_FUTURE');
  });

  it('data antiga não faz lastInteractionAt voltar (GREATEST)', async () => {
    const leadId = await insertLeadRow(w);
    const dealId = await insertDealRow(w, { leadId });
    const recent = new Date(Date.now() - HOUR);
    await asManager(CREATE, {
      i: { leadId, dealId, type: 'call', occurredAt: recent.toISOString() },
    });
    await asManager(CREATE, {
      i: { leadId, dealId, type: 'call', occurredAt: new Date(Date.now() - 3 * DAY).toISOString() },
    });
    expect((await lastAt(dealId))?.getTime()).toBe(recent.getTime());
  });

  it('sem dealId atualiza só os negócios ABERTOS visíveis do lead', async () => {
    const leadId = await insertLeadRow(w);
    const open1 = await insertDealRow(w, { leadId, assignee: w.members.attendant });
    const open2 = await insertDealRow(w, { leadId, assignee: w.attendantB.memberId });
    const lost = await insertDealRow(w, { leadId, status: 'lost' });
    const r = await asManager(CREATE, { i: { leadId, type: 'visit' } });
    expect(r.data.createCommercialInteraction.interaction.dealId).toBeNull();
    expect(await lastAt(open1)).not.toBeNull();
    expect(await lastAt(open2)).not.toBeNull();
    expect(await lastAt(lost)).toBeNull();

    // atendente A só mexe no negócio dela
    const other = await insertLeadRow(w);
    const mine = await insertDealRow(w, { leadId: other, assignee: w.members.attendant });
    const theirs = await insertDealRow(w, { leadId: other, assignee: w.attendantB.memberId });
    const a = await asAttendant(CREATE, { i: { leadId: other, type: 'call' } });
    expect(a.data.createCommercialInteraction.errors).toEqual([]);
    expect(await lastAt(mine)).not.toBeNull();
    expect(await lastAt(theirs)).toBeNull();
  });

  it('nextContactAt no futuro cria o lembrete com título padrão ou informado', async () => {
    const leadId = await insertLeadRow(w, { fullName: 'Maria Noiva' });
    const dealId = await insertDealRow(w, { leadId });
    const due = new Date(Date.now() + 2 * DAY);
    const r = await asManager(CREATE, {
      i: { leadId, dealId, type: 'call', nextContactAt: due.toISOString() },
    });
    const inter = r.data.createCommercialInteraction.interaction;
    expect(inter.reminderId).toBeTruthy();
    const rem = await adminPrisma.commercialReminder.findUniqueOrThrow({
      where: { id: inter.reminderId },
    });
    expect(rem.title).toBe('Retomar contato com Maria Noiva');
    expect(rem.leadId).toBe(leadId);
    expect(rem.dealId).toBe(dealId);
    expect(rem.interactionId).toBe(inter.id);
    expect(rem.createdBy).toBe(w.members.manager);
    expect(rem.dueAt.getTime()).toBe(due.getTime());
    expect(rem.completedAt).toBeNull();

    const r2 = await asManager(CREATE, {
      i: {
        leadId,
        type: 'call',
        nextContactAt: due.toISOString(),
        nextContactTitle: 'Mandar orçamento',
      },
    });
    const rem2 = await adminPrisma.commercialReminder.findUniqueOrThrow({
      where: { id: r2.data.createCommercialInteraction.interaction.reminderId },
    });
    expect(rem2.title).toBe('Mandar orçamento');
    expect(rem2.dealId).toBeNull();

    const long = await asManager(CREATE, {
      i: {
        leadId,
        type: 'call',
        nextContactAt: due.toISOString(),
        nextContactTitle: 'x'.repeat(161),
      },
    });
    expect(long.data.createCommercialInteraction.errors[0].code).toBe('TITLE_TOO_LONG');
  });

  it('nextContactAt no passado é NEXT_CONTACT_PAST e nada é gravado', async () => {
    const leadId = await insertLeadRow(w);
    const dealId = await insertDealRow(w, { leadId });
    const r = await asManager(CREATE, {
      i: {
        leadId,
        dealId,
        type: 'call',
        nextContactAt: new Date(Date.now() - HOUR).toISOString(),
      },
    });
    expect(r.data.createCommercialInteraction.errors[0].code).toBe('NEXT_CONTACT_PAST');
    expect(await adminPrisma.commercialInteraction.count({ where: { leadId } })).toBe(0);
    expect(await adminPrisma.commercialReminder.count({ where: { leadId } })).toBe(0);
    expect(await lastAt(dealId)).toBeNull();
  });

  it('dealId de outro lead e lead invisível são NOT_FOUND', async () => {
    const leadA = await insertLeadRow(w);
    const leadB = await insertLeadRow(w);
    const dealOfB = await insertDealRow(w, { leadId: leadB });
    const r = await asManager(CREATE, { i: { leadId: leadA, dealId: dealOfB, type: 'call' } });
    expect(r.data.createCommercialInteraction.errors[0].code).toBe('NOT_FOUND');

    const theirs = await insertLeadRow(w, { createdBy: w.attendantB.memberId });
    const a = await asAttendant(CREATE, { i: { leadId: theirs, type: 'call' } });
    expect(a.data.createCommercialInteraction.errors[0].code).toBe('NOT_FOUND');
  });

  it('lista em ordem occurredAt desc com limite; lead.interactions; filtro por dealId', async () => {
    const leadId = await insertLeadRow(w);
    const d1 = await insertDealRow(w, { leadId });
    const base = Date.now() - 5 * DAY;
    const ids: string[] = [];
    for (let k = 0; k < 3; k++) {
      const r = await asManager(CREATE, {
        i: {
          leadId,
          dealId: k === 0 ? d1 : null,
          type: 'call',
          occurredAt: new Date(base + k * DAY).toISOString(),
        },
      });
      ids.push(r.data.createCommercialInteraction.interaction.id);
    }
    const all = (await asManager(LIST, { l: leadId })).data.commercialInteractions;
    expect(all.map((x: { id: string }) => x.id)).toEqual([...ids].reverse());
    const lim = (await asManager(LIST, { l: leadId, n: 1 })).data.commercialInteractions;
    expect(lim).toHaveLength(1);
    const byDeal = (await asManager(LIST, { l: leadId, d: d1 })).data.commercialInteractions;
    expect(byDeal.map((x: { id: string }) => x.id)).toEqual([ids[0]]);
    const viaLead = (await asManager(LEAD_INTER, { id: leadId })).data.commercialLead;
    expect(viaLead.interactions).toHaveLength(2);
  });

  it('deleteCommercialInteraction: MANAGER apaga; ATTENDANT é FORBIDDEN; PROFESSIONAL é FORBIDDEN', async () => {
    const leadId = await insertLeadRow(w);
    const r = await asManager(CREATE, { i: { leadId, type: 'call' } });
    const id = r.data.createCommercialInteraction.interaction.id;
    expect(isForbidden(await asAttendant(DELETE, { id }))).toBe(true);
    expect((await asManager(DELETE, { id })).data.deleteCommercialInteraction.ok).toBe(true);
    expect(await adminPrisma.commercialInteraction.count({ where: { id } })).toBe(0);
    expect(isForbidden(await asPro(CREATE, { i: { leadId, type: 'call' } }))).toBe(true);
  });
});
