import { adminPrisma } from './setup';
import {
  createPhase9World,
  destroyPhase9World,
  gqlAs,
  insertDealRow,
  insertLeadRow,
  type Phase9World,
} from './helpers/phase9-fixtures';

const LEAD_FIELDS = `id fullName phone email source notes openDeals lastInteractionAt
  client { id fullName } createdBy { id displayName roleName }`;
const CREATE = `mutation($i: CreateCommercialLeadInput!) {
  createCommercialLead(input: $i) { lead { ${LEAD_FIELDS} } errors { code field } }
}`;
const UPDATE = `mutation($i: UpdateCommercialLeadInput!) {
  updateCommercialLead(input: $i) { lead { ${LEAD_FIELDS} } errors { code field } }
}`;
const LINK = `mutation($l: UUID!, $c: UUID) {
  linkCommercialLeadClient(leadId: $l, clientId: $c) { lead { ${LEAD_FIELDS} } errors { code } }
}`;
const LIST = `query($f: CommercialLeadFilter) {
  commercialLeads(filter: $f) { total items { id fullName } }
}`;
const GET = `query($id: UUID!) { commercialLead(id: $id) { id fullName } }`;
const DUP = `query($p: String, $e: String, $x: UUID) {
  commercialDuplicateCheck(phone: $p, email: $e, excludeLeadId: $x) {
    clients { id fullName } leads { id fullName }
  }
}`;
const DEL = `mutation($id: UUID!) { deleteCommercialLead(id: $id) { ok errors { code } } }`;
const PURGE = `mutation($id: UUID!) { purgeCommercialLead(id: $id) { ok errors { code } } }`;
const ASSIGNEES = `query { commercialAssignees { id displayName roleName } }`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}

type Gql = (q: string, v?: Record<string, unknown>) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('fase 9 — leads, duplicidade e vínculo', () => {
  let w: Phase9World;
  let asManager: Gql;
  let asAttendant: Gql;
  let asAttendantB: Gql;
  let asPro: Gql;

  beforeAll(async () => {
    w = await createPhase9World('p9leads');
    asManager = gqlAs(w, w.tokens.manager);
    asAttendant = gqlAs(w, w.tokens.attendant);
    asAttendantB = gqlAs(w, w.attendantB.token);
    asPro = gqlAs(w, w.tokens.proA);
  });

  afterAll(async () => {
    await destroyPhase9World(w);
  });

  it('create valida contato, telefone e e-mail; grava phone_digits, e-mail minúsculo e criador', async () => {
    const none = await asManager(CREATE, { i: { fullName: 'Ana' } });
    expect(none.data.createCommercialLead.errors[0].code).toBe('CONTACT_REQUIRED');
    const shortPhone = await asManager(CREATE, { i: { fullName: 'Ana', phone: '1234-5678' } });
    expect(shortPhone.data.createCommercialLead.errors[0].code).toBe('PHONE_INVALID');
    const badMail = await asManager(CREATE, { i: { fullName: 'Ana', email: 'ana.com' } });
    expect(badMail.data.createCommercialLead.errors[0].code).toBe('EMAIL_INVALID');
    const noName = await asManager(CREATE, { i: { fullName: '  ', phone: '(11) 98888-7777' } });
    expect(noName.data.createCommercialLead.errors[0].code).toBe('NAME_REQUIRED');

    const ok = await asManager(CREATE, {
      i: { fullName: 'Ana Souza', phone: '+55 (11) 98888-7777', email: 'Ana@Exemplo.COM' },
    });
    const lead = ok.data.createCommercialLead.lead;
    expect(lead.email).toBe('ana@exemplo.com');
    expect(lead.source).toBe('manual');
    expect(lead.createdBy.id).toBe(w.members.manager);
    const row = await adminPrisma.commercialLead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(row.phoneDigits).toBe('11988887777');
  });

  it('commercialDuplicateCheck acha cliente (phone e phone2), lead e e-mail sem caixa', async () => {
    const c1 = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Cli A', phone: '(11) 99999-0000' },
    });
    const c2 = await adminPrisma.client.create({
      data: {
        organizationId: w.orgId,
        fullName: 'Cli B',
        phone: '(21) 91111-2222',
        phone2: '11 9999-0000',
        email: 'Cli.B@Teste.com',
      },
    });
    const leadId = await insertLeadRow(w, { fullName: 'Lead Dup', phone: '11999990000' });
    const r = (await asManager(DUP, { p: '+55 (11) 9 9999-0000' })).data.commercialDuplicateCheck;
    expect(r.clients.map((c: { id: string }) => c.id).sort()).toEqual([c1.id, c2.id].sort());
    expect(r.leads.map((l: { id: string }) => l.id)).toContain(leadId);

    const byMail = (await asManager(DUP, { e: 'cli.b@teste.COM' })).data.commercialDuplicateCheck;
    expect(byMail.clients.map((c: { id: string }) => c.id)).toEqual([c2.id]);

    const excl = (await asManager(DUP, { p: '11999990000', x: leadId })).data
      .commercialDuplicateCheck;
    expect(excl.leads.map((l: { id: string }) => l.id)).not.toContain(leadId);

    const empty = (await asManager(DUP, { p: '123' })).data.commercialDuplicateCheck;
    expect(empty).toEqual({ clients: [], leads: [] });
  });

  it('link liga e desfaz a cliente; criar lead não cria cliente; cliente de outra org é NOT_FOUND', async () => {
    const before = await adminPrisma.client.count({ where: { organizationId: w.orgId } });
    const created = await asManager(CREATE, { i: { fullName: 'Bia', phone: '(11) 97777-1111' } });
    const leadId = created.data.createCommercialLead.lead.id;
    expect(await adminPrisma.client.count({ where: { organizationId: w.orgId } })).toBe(before);

    const linked = await asManager(LINK, { l: leadId, c: w.clientId });
    expect(linked.data.linkCommercialLeadClient.lead.client.id).toBe(w.clientId);
    const unlinked = await asManager(LINK, { l: leadId, c: null });
    expect(unlinked.data.linkCommercialLeadClient.lead.client).toBeNull();

    const other = await adminPrisma.client.create({
      data: { organizationId: w.otherOrgId, fullName: 'Outra Org' },
    });
    const bad = await asManager(LINK, { l: leadId, c: other.id });
    expect(bad.data.linkCommercialLeadClient.errors[0].code).toBe('NOT_FOUND');

    const gone = await adminPrisma.client.create({
      data: { organizationId: w.orgId, fullName: 'Apagada', deletedAt: new Date() },
    });
    const bad2 = await asManager(LINK, { l: leadId, c: gone.id });
    expect(bad2.data.linkCommercialLeadClient.errors[0].code).toBe('NOT_FOUND');
  });

  it('ATTENDANT só vê leads que criou ou com negócio dela', async () => {
    const mine = await insertLeadRow(w, { fullName: 'Da A', createdBy: w.members.attendant });
    const viaDeal = await insertLeadRow(w, { fullName: 'Com negócio da A' });
    await insertDealRow(w, { leadId: viaDeal, assignee: w.members.attendant });
    const theirs = await insertLeadRow(w, { fullName: 'Da B', createdBy: w.attendantB.memberId });
    const unowned = await insertLeadRow(w, { fullName: 'Sem dono' });

    const list = await asAttendant(LIST, { f: { limit: 200 } });
    const ids = list.data.commercialLeads.items.map((i: { id: string }) => i.id);
    expect(ids).toEqual(expect.arrayContaining([mine, viaDeal]));
    expect(ids).not.toContain(theirs);
    expect(ids).not.toContain(unowned);

    expect((await asAttendant(GET, { id: mine })).data.commercialLead.id).toBe(mine);
    expect((await asAttendant(GET, { id: theirs })).data.commercialLead).toBeNull();

    const upd = await asAttendant(UPDATE, { i: { id: theirs, fullName: 'Hack' } });
    expect(upd.data.updateCommercialLead.errors[0].code).toBe('NOT_FOUND');
    const lnk = await asAttendant(LINK, { l: theirs, c: w.clientId });
    expect(lnk.data.linkCommercialLeadClient.errors[0].code).toBe('NOT_FOUND');
    const own = await asAttendant(UPDATE, { i: { id: mine, fullName: 'Da A (editado)' } });
    expect(own.data.updateCommercialLead.lead.fullName).toBe('Da A (editado)');

    // B enxerga o dela e não o da A
    expect((await asAttendantB(GET, { id: theirs })).data.commercialLead.id).toBe(theirs);
    expect((await asAttendantB(GET, { id: mine })).data.commercialLead).toBeNull();

    expect(isForbidden(await asAttendant(DEL, { id: mine }))).toBe(true);
    expect(isForbidden(await asAttendant(PURGE, { id: mine }))).toBe(true);
  });

  it('MANAGER lista tudo; unassigned lista leads sem responsável e sem criador atendente', async () => {
    const siteLead = await insertLeadRow(w, { fullName: 'Do site', source: 'site' });
    const byAtt = await insertLeadRow(w, {
      fullName: 'Criado pela A',
      createdBy: w.members.attendant,
    });
    const withOwner = await insertLeadRow(w, { fullName: 'Com dono' });
    await insertDealRow(w, { leadId: withOwner, assignee: w.members.attendant });
    const noOwnerDeal = await insertLeadRow(w, { fullName: 'Negócio sem dono' });
    await insertDealRow(w, { leadId: noOwnerDeal, assignee: null });

    const all = await asManager(LIST, { f: { limit: 200 } });
    const allIds = all.data.commercialLeads.items.map((i: { id: string }) => i.id);
    expect(allIds).toEqual(expect.arrayContaining([siteLead, byAtt, withOwner, noOwnerDeal]));

    const un = await asManager(LIST, { f: { unassigned: true, limit: 200 } });
    const ids = un.data.commercialLeads.items.map((i: { id: string }) => i.id);
    expect(ids).toEqual(expect.arrayContaining([siteLead, noOwnerDeal]));
    expect(ids).not.toContain(byAtt);
    expect(ids).not.toContain(withOwner);

    const byAssignee = await asManager(LIST, {
      f: { assigneeMemberId: w.members.attendant, limit: 200 },
    });
    const aIds = byAssignee.data.commercialLeads.items.map((i: { id: string }) => i.id);
    expect(aIds).toContain(withOwner);
    expect(aIds).not.toContain(siteLead);

    const search = await asManager(LIST, { f: { search: 'Do site' } });
    expect(search.data.commercialLeads.items.map((i: { id: string }) => i.id)).toEqual([siteLead]);
  });

  it('deleteCommercialLead marca deleted_at no lead e nos negócios; purge apaga com cascata', async () => {
    const leadId = await insertLeadRow(w, { fullName: 'Para apagar' });
    const dealId = await insertDealRow(w, { leadId });
    const del = await asManager(DEL, { id: leadId });
    expect(del.data.deleteCommercialLead).toEqual({ ok: true, errors: [] });
    const lead = await adminPrisma.commercialLead.findUniqueOrThrow({ where: { id: leadId } });
    const deal = await adminPrisma.commercialDeal.findUniqueOrThrow({ where: { id: dealId } });
    expect(lead.deletedAt).not.toBeNull();
    expect(deal.deletedAt).not.toBeNull();
    expect((await asManager(GET, { id: leadId })).data.commercialLead).toBeNull();
    const list = await asManager(LIST, { f: { limit: 200 } });
    expect(list.data.commercialLeads.items.map((i: { id: string }) => i.id)).not.toContain(leadId);

    const purge = await asManager(PURGE, { id: leadId });
    expect(purge.data.purgeCommercialLead).toEqual({ ok: true, errors: [] });
    expect(await adminPrisma.commercialLead.count({ where: { id: leadId } })).toBe(0);
    expect(await adminPrisma.commercialDeal.count({ where: { id: dealId } })).toBe(0);
  });

  it('PROFESSIONAL é barrado em todas as operações de leitura e criação', async () => {
    expect(isForbidden(await asPro(LIST, {}))).toBe(true);
    expect(isForbidden(await asPro(GET, { id: w.clientId }))).toBe(true);
    expect(
      isForbidden(await asPro(CREATE, { i: { fullName: 'X', phone: '(11) 98888-7777' } })),
    ).toBe(true);
    expect(isForbidden(await asPro(DUP, { p: '11988887777' }))).toBe(true);
    expect(isForbidden(await asPro(ASSIGNEES))).toBe(true);
  });

  it('commercialAssignees devolve admin, manager e atendentes, sem profissionais', async () => {
    const r = await asManager(ASSIGNEES);
    const ids = r.data.commercialAssignees.map((m: { id: string }) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        w.members.admin,
        w.members.manager,
        w.members.attendant,
        w.attendantB.memberId,
      ]),
    );
    expect(ids).not.toContain(w.members.proA);
    expect(ids).not.toContain(w.members.proB);
  });
});
