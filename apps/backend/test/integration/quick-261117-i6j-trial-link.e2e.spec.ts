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
import { createServiceRule, OPEN, ADD_ITEM } from './helpers/phase3-comanda-flow';

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

  /** Comanda do teste (purpose) da noiva com item de serviço R$100 ligado ao atendimento. */
  async function trialComanda(
    opts: { purpose?: string; covered?: boolean; contractStatus?: string } = {},
  ) {
    const g = await insertBridalGroupRow(w);
    if (opts.covered === false) {
      await adminPrisma.bridalGroupMember.update({
        where: { id: g.brideMemberId },
        data: { coveredByContract: false },
      });
    }
    const { contractId, code } = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '2200.00',
      depositAmount: '300.00',
      status: opts.contractStatus ?? 'draft',
    });
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
    return { comandaId, itemId, contractId, code, appointmentId: appt.id };
  }

  it('oferece o contrato, liga a R$ 0,00 e fecha sem pagamento com comissão pelo preço cheio', async () => {
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
