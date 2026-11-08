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
import { createServiceRule, OPEN, ADD_ITEM, ADD_PAY, REOPEN } from './helpers/phase3-comanda-flow';

const FIELDS = `id status closeCycle total covered owed paid remaining change canClose closeError
  items { id kind name contractId contractCode listUnitPrice total }`;
const PAYLOAD = `comanda { ${FIELDS} } errors { code message field }`;
const CLOSE = `mutation($id: UUID!) { closeComanda(id: $id) { ${PAYLOAD} } }`;
const GET = `query($id: UUID!) { comanda(id: $id) { ${FIELDS} } }`;

type Cv = {
  id: string;
  status: string;
  closeCycle: number;
  total: string;
  covered: string;
  owed: string;
  remaining: string;
  canClose: boolean;
  items: { id: string; kind: string; contractId: string | null; contractCode: string | null }[];
};
type Pl = { comanda: Cv | null; errors: { code: string; message: string }[] };

describe('Phase 4 - comanda abatida por contrato (D-08)', () => {
  let w: Phase4World;
  const filter = `SELECT id FROM organizations WHERE legal_name LIKE 'p4cc-%'`;

  beforeAll(async () => {
    w = await createPhase4World('p4cc');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });
  afterEach(async () => {
    await deletePhase4Rows(filter);
    await deletePhase3Rows(filter);
    await adminPrisma.commissionRule.deleteMany({ where: { organizationId: w.orgId } });
    await adminPrisma.product.update({ where: { id: w.productId }, data: { stockQuantity: 10 } });
    await adminPrisma.stockMovement.deleteMany({ where: { organizationId: w.orgId } });
  });

  const att = () => gqlAs(w, w.tokens.attendant);

  /** Comanda com serviço R$100 + produto R$35, ambos cobertos pelo contrato. */
  async function coveredComanda() {
    const open = (await att()(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Pl;
    const comandaId = open.comanda!.id;
    const add = (extra: Record<string, unknown>) =>
      att()(ADD_ITEM, { i: { comandaId, professionalId: w.members.proA, quantity: 1, ...extra } });
    await add({ kind: 'service', serviceId: w.serviceId });
    await add({ kind: 'product', productId: w.productId });
    const g = await insertBridalGroupRow(w);
    const { contractId, code } = await insertContractRow(w, {
      groupId: g.groupId,
      brideClientId: g.brideClientId,
      totalAmount: '8000.00',
      depositAmount: '2400.00',
      status: 'active',
    });
    await adminPrisma.comandaItem.updateMany({ where: { comandaId }, data: { contractId } });
    return { comandaId, contractId, code, add };
  }

  it('fecha sem pagamento: a pagar 0, sem caixa, comissão pelo preço cheio, estoque baixa', async () => {
    await createServiceRule(w, w.serviceId, '40');
    const { comandaId, code } = await coveredComanda();

    const view = (await att()(GET, { id: comandaId })).data.comanda as Cv;
    expect(view).toMatchObject({ total: '135.00', covered: '135.00', owed: '0.00', canClose: true });
    expect(view.items.every((i) => i.contractCode === code)).toBe(true);

    const r = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(r.errors).toEqual([]);
    expect(r.comanda).toMatchObject({ status: 'closed', closeCycle: 1, owed: '0.00', covered: '135.00' });

    expect(await adminPrisma.cashMovement.count({ where: { comandaId } })).toBe(0);
    const rec = await adminPrisma.commissionRecord.findMany({ where: { comandaId, kind: 'accrual' } });
    expect(rec).toHaveLength(2);
    const svc = rec.find((x) => Number(x.baseAmount) === 100)!;
    expect(String(svc.calculatedAmount)).toBe('40');
    const product = await adminPrisma.product.findUnique({ where: { id: w.productId } });
    expect(product!.stockQuantity).toBe(9);
  });

  it('extra do dia é cobrado: INSUFFICIENT_PAYMENT sem pagar; fecha pagando só o extra', async () => {
    const { comandaId, add } = await coveredComanda();
    await add({ kind: 'product', productId: w.productId });
    const extra = (await att()(GET, { id: comandaId })).data.comanda;
    expect(extra).toMatchObject({ total: '170.00', covered: '135.00', owed: '35.00' });

    const fail = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(fail.errors[0].code).toBe('INSUFFICIENT_PAYMENT');
    expect(fail.errors[0].message).toContain('Falta R$ 35,00');

    const pay = (await att()(ADD_PAY, { i: { comandaId, method: 'cash', amount: '35.00' } })).data
      .addComandaPayment as Pl;
    expect(pay.errors).toEqual([]);
    expect(pay.comanda!.canClose).toBe(true);

    const ok = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(ok.errors).toEqual([]);
    expect(ok.comanda!.status).toBe('closed');

    const product = await adminPrisma.product.findUnique({ where: { id: w.productId } });
    expect(product!.stockQuantity).toBe(8);
    const cash = await adminPrisma.cashMovement.findMany({ where: { comandaId } });
    expect(cash).toHaveLength(1);
    expect(cash[0]).toMatchObject({ kind: 'payment_in', method: 'cash' });
    expect(String(cash[0].amount)).toBe('35');
  });

  it('fechar -> reabrir -> fechar: estorna só o extra, comissões revertidas e recriadas', async () => {
    await createServiceRule(w, w.serviceId, '40');
    const { comandaId, add } = await coveredComanda();
    await add({ kind: 'product', productId: w.productId });
    await att()(ADD_PAY, { i: { comandaId, method: 'cash', amount: '35.00' } });
    expect(((await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl).errors).toEqual([]);

    const re = (
      await gqlAs(w, w.tokens.admin)(REOPEN, { i: { id: comandaId, reason: 'ajuste do contrato' } })
    ).data.reopenComanda as Pl;
    expect(re.errors).toEqual([]);
    expect(re.comanda!.status).toBe('open');

    const again = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(again.errors).toEqual([]);
    expect(again.comanda).toMatchObject({ status: 'closed', closeCycle: 2, owed: '35.00', remaining: '0.00' });

    const cash = await adminPrisma.cashMovement.findMany({ where: { comandaId }, orderBy: { createdAt: 'asc' } });
    const net = cash.reduce((a, c) => a + Math.round(Number(c.amount) * 100), 0);
    expect(net).toBe(3500);
    expect(cash.map((c) => c.kind)).toEqual(['payment_in', 'reversal', 'payment_in']);
    expect(cash.every((c) => Math.abs(Number(c.amount)) === 35)).toBe(true);

    const rec = await adminPrisma.commissionRecord.findMany({ where: { comandaId } });
    expect(rec.filter((x) => x.kind === 'accrual')).toHaveLength(6);
    expect(rec.filter((x) => x.kind === 'reversal')).toHaveLength(3);
    const product = await adminPrisma.product.findUnique({ where: { id: w.productId } });
    expect(product!.stockQuantity).toBe(8);
  });

  it('comanda sem cobertura segue idêntica à fase 3', async () => {
    const open = (await att()(OPEN, { i: { clientId: w.clientId } })).data.openWalkInComanda as Pl;
    const comandaId = open.comanda!.id;
    await att()(ADD_ITEM, {
      i: { comandaId, professionalId: w.members.proA, quantity: 1, kind: 'service', serviceId: w.serviceId },
    });
    const v = (await att()(GET, { id: comandaId })).data.comanda as Cv;
    expect(v).toMatchObject({ total: '100.00', covered: '0.00', owed: '100.00', canClose: false });
    const fail = (await att()(CLOSE, { id: comandaId })).data.closeComanda as Pl;
    expect(fail.errors[0].code).toBe('INSUFFICIENT_PAYMENT');
  });

  describe('teste incluso no pacote (261108-n2o)', () => {
    const SCHEDULE = `mutation($input: ScheduleBridalEventInput!) {
      scheduleBridalEvent(input: $input) { appointmentIds errors { code message field } }
    }`;
    const CREATE_CONTRACT = `mutation($input: CreateContractInput!) {
      createContract(input: $input) { contract { id items { serviceId purpose total settledAtEvent } } errors { code message } }
    }`;
    const UPDATE_CONTRACT = `mutation($id: UUID!, $input: UpdateContractInput!) {
      updateContract(id: $id, input: $input) { contract { id } errors { code message } }
    }`;
    const VIEW = `query($id: UUID!) {
      comanda(id: $id) { id total covered owed items { name contractId unitPrice total includedInEvent } }
    }`;
    type Item = { name: string; contractId: string | null; unitPrice: string; total: string; includedInEvent: boolean };
    type View = { total: string; covered: string; owed: string; items: Item[] };

    const localDay = (offset: number) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(Date.now() + offset * 86_400_000),
      );
    const at = (day: string, hh: number) => `${day}T${String(hh + 3).padStart(2, '0')}:00:00.000Z`;
    const eventDay = localDay(60);
    const trialDay = localDay(45);
    const packages: string[] = [];

    afterEach(async () => {
      await deletePhase3Rows(filter);
      for (const t of ['cash_movements', 'client_credit_movements', 'appointments']) {
        await adminPrisma.$executeRawUnsafe(`DELETE FROM ${t} WHERE organization_id = '${w.orgId}'::uuid`);
      }
      await deletePhase4Rows(filter);
      await adminPrisma.packageService.deleteMany({ where: { packageId: { in: packages } } });
      await adminPrisma.package.deleteMany({ where: { id: { in: packages } } });
      packages.length = 0;
    });

    /** Pacote R$ 600: serviço A (R$ 100 avulso) com teste incluso → 400 = 200 + 200; B → 200. */
    async function trialPackage() {
      const p = await adminPrisma.package.create({
        data: {
          organizationId: w.orgId,
          name: `p4cc-pacote-teste-${Date.now()}`,
          price: '600.00',
          depositKind: 'percent',
          depositValue: '30.00',
          services: {
            create: [
              { serviceId: w.serviceId, quantity: 1, displayOrder: 0, includesTrial: true },
              { serviceId: w.serviceBId, quantity: 1, displayOrder: 1 },
            ],
          },
        },
      });
      packages.push(p.id);
      return p.id;
    }

    /** Agenda teste (A) e evento (A + B) da noiva; devolve as comandas do teste e do evento. */
    async function scheduleBride(brideMemberId: string, groupId: string) {
      const item = (serviceId: string, day: string, hh: number, purpose: string) => ({
        groupMemberId: brideMemberId,
        serviceId,
        professionalId: w.members.proA,
        startsAt: at(day, hh),
        endsAt: at(day, hh + 1),
        purpose,
      });
      const r = await att()(SCHEDULE, {
        input: {
          groupId,
          items: [
            item(w.serviceId, trialDay, 10, 'trial'),
            item(w.serviceId, eventDay, 9, 'event'),
            item(w.serviceBId, eventDay, 10, 'event'),
          ],
        },
      });
      expect(r.data.scheduleBridalEvent.errors).toEqual([]);
      const appts = await adminPrisma.appointment.findMany({
        where: { bridalGroupId: groupId },
        select: { purpose: true, comandaId: true },
      });
      const trialComanda = appts.find((a) => a.purpose === 'trial')!.comandaId!;
      const eventComanda = appts.find((a) => a.purpose === 'event')!.comandaId!;
      const view = async (id: string) => (await att()(VIEW, { id })).data.comanda as View;
      return { trialComanda, eventComanda, view };
    }

    it('comanda do teste a R$ 0,00 com aviso; a do evento leva as duas metades', async () => {
      const pkg = await trialPackage();
      const g = await insertBridalGroupRow(w, { companions: 0, eventDate: eventDay });
      const c = await gqlAs(w, w.tokens.admin)(CREATE_CONTRACT, {
        input: { groupId: g.groupId, packageId: pkg },
      });
      expect(c.data.createContract.errors).toEqual([]);
      const contractId = c.data.createContract.contract.id;
      expect(
        c.data.createContract.contract.items.map((i: { purpose: string; total: string }) => [
          i.purpose,
          i.total,
        ]),
      ).toEqual([
        ['event', '200.00'],
        ['trial', '200.00'],
        ['event', '200.00'],
      ]);

      const { trialComanda, eventComanda, view } = await scheduleBride(g.brideMemberId, g.groupId);
      const check = async () => {
        const t = await view(trialComanda);
        expect(t.items).toHaveLength(1);
        expect(t.items[0]).toMatchObject({ contractId, total: '0.00', includedInEvent: true });
        expect(t).toMatchObject({ total: '0.00', owed: '0.00' });
        const e = await view(eventComanda);
        expect(e.items.map((i) => i.total).sort()).toEqual(['200.00', '400.00']);
        expect(e.items.every((i) => i.contractId === contractId && !i.includedInEvent)).toBe(true);
        expect(e).toMatchObject({ total: '600.00', covered: '600.00', owed: '0.00' });
        // soma das comandas cobertas = valor do contrato
        expect(Number(t.covered) + Number(e.covered)).toBe(600);
      };
      await check();

      // editar o contrato ressincroniza a cobertura das comandas abertas: valores se mantêm
      const up = await gqlAs(w, w.tokens.admin)(UPDATE_CONTRACT, {
        id: contractId,
        input: { discountAmount: '10.00' },
      });
      expect(up.data.updateContract.errors).toEqual([]);
      await check();
    });

    it('teste avulso (fora do pacote) continua com o preço do contrato no dia do teste', async () => {
      const g = await insertBridalGroupRow(w, { companions: 0, eventDate: eventDay });
      const c = await gqlAs(w, w.tokens.admin)(CREATE_CONTRACT, {
        input: {
          groupId: g.groupId,
          items: [
            { serviceId: w.serviceId, unitPrice: '300.00', purpose: 'event' },
            { serviceId: w.serviceId, unitPrice: '80.00', purpose: 'trial' },
            { serviceId: w.serviceBId, unitPrice: '50.00', purpose: 'event' },
          ],
        },
      });
      expect(c.data.createContract.errors).toEqual([]);
      expect(
        c.data.createContract.contract.items.every((i: { settledAtEvent: boolean }) => !i.settledAtEvent),
      ).toBe(true);
      const { trialComanda, eventComanda, view } = await scheduleBride(g.brideMemberId, g.groupId);
      const t = await view(trialComanda);
      expect(t.items[0]).toMatchObject({ total: '80.00', includedInEvent: false });
      expect(t.covered).toBe('80.00');
      const e = await view(eventComanda);
      expect(e.items.map((i) => i.total).sort()).toEqual(['300.00', '50.00']);
    });
  });
});
