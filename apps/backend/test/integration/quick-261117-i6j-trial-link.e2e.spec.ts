import { adminPrisma } from './setup';
import { gqlAs } from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';
import {
  createPhase4World,
  destroyPhase4World,
  insertBridalGroupRow,
  insertContractRow,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase4Rows } from './helpers/phase4-cleanup';
import { createServiceRule, OPEN, ADD_ITEM, ADD_PAY } from './helpers/phase3-comanda-flow';

const FIELDS = `id status total covered owed canClose
  items { id contractId contractCode includedInEvent linkableContractId linkableContractCode
    listUnitPrice unitPrice total }`;
const PAYLOAD = `comanda { ${FIELDS} } errors { code message field }`;
const LINK = `mutation($c: UUID!, $i: UUID!) {
  linkComandaItemToContract(comandaId: $c, itemId: $i) { ${PAYLOAD} } }`;
const CLOSE = `mutation($id: UUID!) { closeComanda(id: $id) { ${PAYLOAD} } }`;
const GET = `query($id: UUID!) { comanda(id: $id) { ${FIELDS} } }`;

type Item = {
  id: string;
  contractId: string | null;
  contractCode: string | null;
  includedInEvent: boolean;
  linkableContractId: string | null;
  linkableContractCode: string | null;
  listUnitPrice: string;
  total: string;
};
type Cv = { id: string; status: string; total: string; owed: string; canClose: boolean; items: Item[] };
type Pl = { comanda: Cv | null; errors: { code: string; message: string }[] };

let hour = 8;

describe('Quick 261117-i6j - vincular teste de noiva ao contrato na comanda', () => {
  let w: Phase4World;
  const filter = `SELECT id FROM organizations WHERE legal_name LIKE 'q6j-%'`;

  beforeAll(async () => {
    w = await createPhase4World('q6j');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(filter);
    await deletePhase3Rows(filter);
    await adminPrisma.commissionRule.deleteMany({ where: { organizationId: w.orgId } });
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const amount = async (comandaId: string) =>
    (await adminPrisma.commissionRecord.findMany({ where: { comandaId } })).reduce(
      (a, r) => a + Number(r.calculatedAmount),
      0,
    );

  /** Comanda do teste (purpose) da noiva com item de serviço R$100 ligado ao atendimento. */
  async function trialComanda(
    opts: {
      purpose?: string;
      covered?: boolean;
      contractStatus?: string;
      /** Reaproveita grupo e contrato de outra chamada (evento do mesmo contrato do teste). */
      same?: { g: Awaited<ReturnType<typeof insertBridalGroupRow>>; contractId: string; code: string };
    } = {},
  ) {
    const g = opts.same?.g ?? (await insertBridalGroupRow(w));
    if (opts.covered === false) {
      await adminPrisma.bridalGroupMember.update({
        where: { id: g.brideMemberId },
        data: { coveredByContract: false },
      });
    }
    const { contractId, code } =
      opts.same ??
      (await insertContractRow(w, {
        groupId: g.groupId,
        brideClientId: g.brideClientId,
        totalAmount: '2200.00',
        depositAmount: '300.00',
        status: opts.contractStatus ?? 'draft',
      }));
    const open = (await att()(OPEN, { i: { clientId: g.brideClientId } })).data
      .openWalkInComanda as Pl;
    const comandaId = open.comanda!.id;
    const added = (
      await att()(ADD_ITEM, {
        i: { comandaId, kind: 'service', serviceId: w.serviceId, professionalId: w.members.proA, quantity: 1 },
      })
    ).data.addComandaItem as Pl;
    const itemId = added.comanda!.items[0].id;
    const h = hour++;
    const appt = await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: g.brideClientId,
        serviceId: w.serviceId,
        startsAt: new Date(`2030-06-10T${String(h).padStart(2, '0')}:00:00.000Z`),
        endsAt: new Date(`2030-06-10T${String(h).padStart(2, '0')}:59:00.000Z`),
        bridalGroupId: g.groupId,
        purpose: opts.purpose ?? 'trial',
        comandaId,
      },
    });
    await adminPrisma.comandaItem.update({ where: { id: itemId }, data: { appointmentId: appt.id } });
    return { comandaId, itemId, contractId, code, appointmentId: appt.id, g };
  }

  it('oferece o contrato, liga a R$ 0,00 e fecha sem pagamento; teste fica com metade da comissão', async () => {
    await createServiceRule(w, w.serviceId, '40');
    const { comandaId, itemId, contractId, code, appointmentId } = await trialComanda();

    const before = (await att()(GET, { id: comandaId })).data.comanda as Cv;
    expect(before.items[0]).toMatchObject({
      contractId: null,
      linkableContractId: contractId,
      linkableContractCode: code,
    });
    expect(before).toMatchObject({ owed: '100.00', canClose: false });

    const r = (await att()(LINK, { c: comandaId, i: itemId })).data.linkComandaItemToContract as Pl;
    expect(r.errors).toEqual([]);
    expect(r.comanda!.items[0]).toMatchObject({
      contractId,
      contractCode: code,
      includedInEvent: true,
      linkableContractId: null,
      listUnitPrice: '100.00',
      total: '0.00',
    });
    expect(r.comanda).toMatchObject({ total: '0.00', owed: '0.00', canClose: true });
    const appt = await adminPrisma.appointment.findUnique({ where: { id: appointmentId } });
    expect(appt!.contractId).toBe(contractId);

    const again = (await att()(LINK, { c: comandaId, i: itemId })).data
      .linkComandaItemToContract as Pl;
    expect(again.errors).toEqual([]);

    const closed = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(closed.errors).toEqual([]);
    expect(closed.comanda!.status).toBe('closed');
    expect(await adminPrisma.cashMovement.count({ where: { comandaId } })).toBe(0);
    const rec = await adminPrisma.commissionRecord.findMany({ where: { comandaId, kind: 'accrual' } });
    expect(rec).toHaveLength(1);
    expect(Number(rec[0].baseAmount)).toBe(100);
    // 261124-ijh: teste e evento são um serviço só; a comissão (40% de 100) se divide 20 + 20.
    expect(Number(rec[0].calculatedAmount)).toBe(20);
    expect(rec[0].noRule).toBe(false);
    expect(rec[0].ruleSnapshot).toMatchObject({ settledAtEvent: true, splitWithTrial: 'trial' });
  });

  it('regra fixa: teste incluso e evento coberto dividem a comissão (200 + 200)', async () => {
    await adminPrisma.commissionRule.create({
      data: {
        organizationId: w.orgId,
        scopeType: 'service',
        serviceId: w.serviceId,
        kind: 'fixed',
        value: '400',
      },
    });
    const trial = await trialComanda();
    await att()(LINK, { c: trial.comandaId, i: trial.itemId });
    expect(((await att()(CLOSE, { id: trial.comandaId })).data.closeComanda as Pl).errors).toEqual([]);

    const event = await trialComanda({ purpose: 'event', same: trial });
    await adminPrisma.comandaItem.update({
      where: { id: event.itemId },
      data: { contractId: trial.contractId },
    });
    expect(((await att()(CLOSE, { id: event.comandaId })).data.closeComanda as Pl).errors).toEqual([]);

    expect(await amount(trial.comandaId)).toBe(200);
    expect(await amount(event.comandaId)).toBe(200);
    const ev = await adminPrisma.commissionRecord.findFirstOrThrow({ where: { comandaId: event.comandaId } });
    expect(ev.ruleSnapshot).toMatchObject({ splitWithTrial: 'event' });
  });

  it('regra fixa: evento coberto sem teste incluso fica com a comissão inteira', async () => {
    await adminPrisma.commissionRule.create({
      data: { organizationId: w.orgId, scopeType: 'service', serviceId: w.serviceId, kind: 'fixed', value: '400' },
    });
    const event = await trialComanda({ purpose: 'event' });
    await adminPrisma.comandaItem.update({
      where: { id: event.itemId },
      data: { contractId: event.contractId },
    });
    expect(((await att()(CLOSE, { id: event.comandaId })).data.closeComanda as Pl).errors).toEqual([]);
    expect(await amount(event.comandaId)).toBe(400);
  });

  it('regra fixa: teste cancelado não divide; o evento fica com tudo', async () => {
    await adminPrisma.commissionRule.create({
      data: { organizationId: w.orgId, scopeType: 'service', serviceId: w.serviceId, kind: 'fixed', value: '400' },
    });
    const trial = await trialComanda();
    await att()(LINK, { c: trial.comandaId, i: trial.itemId });
    await adminPrisma.appointment.update({
      where: { id: trial.appointmentId },
      data: { status: 'cancelled' },
    });
    const event = await trialComanda({ purpose: 'event', same: trial });
    await adminPrisma.comandaItem.update({
      where: { id: event.itemId },
      data: { contractId: trial.contractId },
    });
    expect(((await att()(CLOSE, { id: event.comandaId })).data.closeComanda as Pl).errors).toEqual([]);
    expect(await amount(event.comandaId)).toBe(400);
  });

  it('relatório: teste incluso + dia da noiva contam 1 atendimento (261117-mtn)', async () => {
    await adminPrisma.commissionRule.create({
      data: { organizationId: w.orgId, scopeType: 'service', serviceId: w.serviceId, kind: 'fixed', value: '400' },
    });
    const trial = await trialComanda();
    await att()(LINK, { c: trial.comandaId, i: trial.itemId });
    expect(((await att()(CLOSE, { id: trial.comandaId })).data.closeComanda as Pl).errors).toEqual([]);
    // reabrir e fechar de novo (estorno no meio) não pode virar atendimento a mais
    const REOPEN = `mutation($i: ReopenComandaInput!) { reopenComanda(input: $i) { ${PAYLOAD} } }`;
    const re = (await gqlAs(w, w.tokens.admin)(REOPEN, { i: { id: trial.comandaId, reason: 'teste' } })).data
      .reopenComanda as Pl;
    expect(re.errors).toEqual([]);
    expect(((await att()(CLOSE, { id: trial.comandaId })).data.closeComanda as Pl).errors).toEqual([]);

    const event = await trialComanda({ purpose: 'event', same: trial });
    await adminPrisma.comandaItem.update({
      where: { id: event.itemId },
      data: { contractId: trial.contractId },
    });
    expect(((await att()(CLOSE, { id: event.comandaId })).data.closeComanda as Pl).errors).toEqual([]);

    const today = new Date();
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const from = ymd(new Date(today.getTime() - 2 * 86400000));
    const to = ymd(new Date(today.getTime() + 2 * 86400000));
    const q = `query($f: String!, $t: String!, $m: UUID) {
      commissionRecords(from: $f, to: $t, memberId: $m) {
        id kind comandaId bridalTrialIncluded trialDate reversesRecordId contractId calculatedAmount }
      commissionTotals(from: $f, to: $t, memberId: $m) { records total }
    }`;
    const d = (await gqlAs(w, w.tokens.admin)(q, { f: from, t: to, m: w.members.proA })).data;
    expect(d.commissionTotals).toEqual([{ records: 1, total: '400.00' }]);
    type R = {
      id: string;
      kind: string;
      comandaId: string;
      bridalTrialIncluded: boolean;
      trialDate: string | null;
      reversesRecordId: string | null;
      contractId: string | null;
    };
    const recs = d.commissionRecords as R[];
    const trialRecs = recs.filter((r) => r.comandaId === trial.comandaId);
    expect(trialRecs.length).toBeGreaterThanOrEqual(3);
    expect(trialRecs.every((r) => r.bridalTrialIncluded && r.contractId === trial.contractId)).toBe(true);
    const rev = trialRecs.find((r) => r.kind === 'reversal')!;
    expect(trialRecs.map((r) => r.id)).toContain(rev.reversesRecordId);
    const ev = recs.find((r) => r.comandaId === event.comandaId)!;
    expect(ev).toMatchObject({ bridalTrialIncluded: false, contractId: trial.contractId });
    const trialAppt = await adminPrisma.appointment.findUniqueOrThrow({ where: { id: trial.appointmentId } });
    expect(new Date(ev.trialDate!).getTime()).toBe(trialAppt.startsAt.getTime());
  });

  it('teste avulso (pago, sem contrato) segue com comissão normal', async () => {
    await createServiceRule(w, w.serviceId, '40');
    const { comandaId } = await trialComanda();
    await att()(ADD_PAY, { i: { comandaId, method: 'pix', amount: '100.00' } });
    expect(((await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl).errors).toEqual([]);
    const rec = await adminPrisma.commissionRecord.findMany({ where: { comandaId, kind: 'accrual' } });
    expect(rec).toHaveLength(1);
    expect(Number(rec[0].calculatedAmount)).toBe(40);
  });

  it.each([
    ['atendimento do evento', { purpose: 'event' }],
    ['cliente não coberta pelo contrato', { covered: false }],
    ['contrato cancelado', { contractStatus: 'cancelled' }],
  ])('recusa: %s', async (_label, opts) => {
    const { comandaId, itemId } = await trialComanda(opts);
    const view = (await att()(GET, { id: comandaId })).data.comanda as Cv;
    expect(view.items[0].linkableContractId).toBeNull();
    const r = (await att()(LINK, { c: comandaId, i: itemId })).data.linkComandaItemToContract as Pl;
    expect(r.errors[0].code).toBe('ITEM_NOT_LINKABLE');
    const item = await adminPrisma.comandaItem.findUnique({ where: { id: itemId } });
    expect(item!.contractId).toBeNull();
    expect(String(item!.total)).toBe('100');
  });
});
