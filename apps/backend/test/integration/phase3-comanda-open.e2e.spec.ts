import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';

const COMANDA_FIELDS = `
  id code status clientId total paid remaining change canClose closeError clientCreditBalance
  client { id fullName phone email cpf }
  items { id kind serviceId productId packageId appointmentId serviceVariantId professionalId name quantity listUnitPrice unitPrice total professional { id displayName } }
  payments { id method amount }
  appointmentIds`;
const PAYLOAD = `comanda { ${COMANDA_FIELDS} } errors { code message field }`;
const OPEN = `mutation($i: OpenWalkInComandaInput!) { openWalkInComanda(input: $i) { ${PAYLOAD} } }`;
const ADD_ITEM = `mutation($i: AddComandaItemInput!) { addComandaItem(input: $i) { ${PAYLOAD} } }`;
const REMOVE_ITEM = `mutation($c: UUID!, $i: UUID!) { removeComandaItem(comandaId: $c, itemId: $i) { ${PAYLOAD} } }`;
const ADD_PKG = `mutation($i: AddComandaPackageInput!) { addComandaPackage(input: $i) { ${PAYLOAD} } }`;
const GET = `query($id: UUID!) { comanda(id: $id) { ${COMANDA_FIELDS} } }`;
const LIST = `query($f: String!, $t: String!) { comandas(from: $f, to: $t) { id code } }`;

describe('Phase 3 - abertura e itens da comanda', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p3open');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await deletePhase3Rows(
      `SELECT id FROM organizations WHERE legal_name LIKE 'p3open-%'`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM appointments WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM member_categories WHERE organization_id = '${w.orgId}'::uuid`,
    );
  });

  const att = () => gqlAs(w, w.tokens.attendant);
  const openFor = async (clientId = w.clientId) =>
    (await att()(OPEN, { i: { clientId } })).data.openWalkInComanda.comanda as {
      id: string;
      total: string;
      items: { id: string; unitPrice: string; listUnitPrice: string; name: string }[];
    };
  const addSvc = (comandaId: string, extra: Record<string, unknown> = {}) =>
    att()(ADD_ITEM, {
      i: {
        comandaId,
        kind: 'service',
        serviceId: w.serviceId,
        professionalId: w.members.proA,
        quantity: 1,
        ...extra,
      },
    });

  it('walk-in com cliente novo só com nome, sem CPF/e-mail', async () => {
    const res = await att()(OPEN, { i: { newClient: { fullName: 'Maria Walk-in' } } });
    const p = res.data.openWalkInComanda;
    expect(p.errors).toEqual([]);
    expect(p.comanda.status).toBe('open');
    expect(p.comanda.code).toMatch(/^C-\d{4}-\d{3}$/);
    expect(p.comanda.total).toBe('0.00');
    expect(p.comanda.client).toMatchObject({
      fullName: 'Maria Walk-in',
      phone: null,
      email: null,
      cpf: null,
    });
  });

  it('walk-in com cliente existente e telefone opcional no novo', async () => {
    const existing = await att()(OPEN, { i: { clientId: w.clientId } });
    expect(existing.data.openWalkInComanda.comanda.client.id).toBe(w.clientId);
    const withPhone = await att()(OPEN, {
      i: { newClient: { fullName: 'Ana Silva', phone: ' +5511977770000 ' } },
    });
    expect(withPhone.data.openWalkInComanda.comanda.client.phone).toBe('+5511977770000');
  });

  it('exige exatamente um entre clientId e newClient', async () => {
    const none = await att()(OPEN, { i: {} });
    expect(none.data.openWalkInComanda.errors[0].code).toBe('CLIENT_REQUIRED');
    const both = await att()(OPEN, {
      i: { clientId: w.clientId, newClient: { fullName: 'Fulana' } },
    });
    expect(both.data.openWalkInComanda.errors[0].code).toBe('CLIENT_REQUIRED');
    const badName = await att()(OPEN, { i: { newClient: { fullName: ' x ' } } });
    expect(badName.data.openWalkInComanda.errors[0].code).toBe('INVALID_NAME');
  });

  it('serviço com variante usa o preço da variante; sem variante usa o base', async () => {
    const c = await openFor();
    const withVariant = (await addSvc(c.id, { serviceVariantId: w.variantId })).data
      .addComandaItem;
    expect(withVariant.errors).toEqual([]);
    expect(withVariant.comanda.items[0]).toMatchObject({
      listUnitPrice: '120.00',
      unitPrice: '120.00',
      total: '120.00',
      serviceVariantId: w.variantId,
    });
    expect(withVariant.comanda.total).toBe('120.00');

    const c2 = await openFor();
    const plain = (await addSvc(c2.id)).data.addComandaItem;
    expect(plain.comanda.total).toBe('100.00');
    expect(plain.comanda.items[0].professionalId).toBe(w.members.proA);
  });

  it('produto soma ao total e não baixa estoque', async () => {
    const c = await openFor();
    await addSvc(c.id);
    const res = (
      await att()(ADD_ITEM, {
        i: {
          comandaId: c.id,
          kind: 'product',
          productId: w.productId,
          professionalId: w.members.proA,
          quantity: 2,
        },
      })
    ).data.addComandaItem;
    expect(res.errors).toEqual([]);
    expect(res.comanda.total).toBe('170.00');
    const product = await adminPrisma.product.findUniqueOrThrow({ where: { id: w.productId } });
    expect(product.stockQuantity).toBe(10);
  });

  it('valida quantidade e tipo do item', async () => {
    const c = await openFor();
    expect((await addSvc(c.id, { quantity: 0 })).data.addComandaItem.errors[0].code).toBe(
      'INVALID_QUANTITY',
    );
    const kind = await att()(ADD_ITEM, {
      i: { comandaId: c.id, kind: 'voucher', professionalId: w.members.proA, quantity: 1 },
    });
    expect(kind.data.addComandaItem.errors[0].code).toBe('INVALID_KIND');
  });

  it('pacote vira 1 item por unidade com rateio exato e preço cheio guardado', async () => {
    const c = await openFor();
    const r = (
      await att()(ADD_PKG, {
        i: {
          comandaId: c.id,
          packageId: w.packageId,
          assignments: [
            { serviceId: w.serviceId, professionalId: w.members.proA },
            { serviceId: w.serviceBId, professionalId: w.members.proB },
          ],
        },
      })
    ).data.addComandaPackage;
    expect(r.errors).toEqual([]);
    const items = r.comanda.items;
    expect(items).toHaveLength(2);
    expect(items.map((i: { unitPrice: string }) => i.unitPrice)).toEqual(['90.00', '45.00']);
    expect(items.map((i: { listUnitPrice: string }) => i.listUnitPrice)).toEqual([
      '100.00',
      '50.00',
    ]);
    expect(items.every((i: { packageId: string }) => i.packageId === w.packageId)).toBe(true);
    expect(r.comanda.total).toBe('135.00');
  });

  it('pacote exige profissional para cada serviço', async () => {
    const c = await openFor();
    const r = (
      await att()(ADD_PKG, {
        i: {
          comandaId: c.id,
          packageId: w.packageId,
          assignments: [{ serviceId: w.serviceId, professionalId: w.members.proA }],
        },
      })
    ).data.addComandaPackage;
    expect(r.errors[0].code).toBe('MISSING_ASSIGNMENT');
  });

  it('remove item recalcula o total; item de agendamento não pode ser removido', async () => {
    const c = await openFor();
    const a = (await addSvc(c.id)).data.addComandaItem.comanda;
    const b = (await addSvc(c.id, { serviceVariantId: w.variantId })).data.addComandaItem
      .comanda;
    expect(b.total).toBe('220.00');
    const removed = (await att()(REMOVE_ITEM, { c: c.id, i: a.items[0].id })).data
      .removeComandaItem;
    expect(removed.comanda.total).toBe('120.00');

    const appt = await adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: new Date('2030-01-01T13:00:00Z'),
        endsAt: new Date('2030-01-01T14:00:00Z'),
      },
    });
    const linked = await adminPrisma.comandaItem.create({
      data: {
        organizationId: w.orgId,
        comandaId: c.id,
        kind: 'service',
        serviceId: w.serviceId,
        appointmentId: appt.id,
        professionalId: w.members.proA,
        nameSnapshot: 'x',
        quantity: 1,
        listUnitPrice: '100.00',
        unitPrice: '100.00',
        total: '100.00',
      },
    });
    const denied = (await att()(REMOVE_ITEM, { c: c.id, i: linked.id })).data
      .removeComandaItem;
    expect(denied.errors[0].code).toBe('ITEM_LINKED_TO_APPOINTMENT');
    const missing = (
      await att()(REMOVE_ITEM, { c: c.id, i: '00000000-0000-4000-8000-000000000000' })
    ).data.removeComandaItem;
    expect(missing.errors[0].code).toBe('ITEM_NOT_FOUND');
  });

  it('profissional que não atende a categoria é recusado', async () => {
    const other = await adminPrisma.category.create({
      data: { organizationId: w.orgId, name: 'p3open-Unhas' },
    });
    await adminPrisma.memberCategory.create({
      data: { organizationId: w.orgId, memberId: w.members.proB, categoryId: other.id },
    });
    const c = await openFor();
    const r = (await addSvc(c.id, { professionalId: w.members.proB })).data.addComandaItem;
    expect(r.errors[0].code).toBe('PROFESSIONAL_DOES_NOT_SERVE_CATEGORY');
    await adminPrisma.memberCategory.deleteMany({ where: { categoryId: other.id } });
    await adminPrisma.category.delete({ where: { id: other.id } });
  });

  it('comanda que não está aberta não aceita alterações', async () => {
    const c = await openFor();
    await adminPrisma.comanda.update({ where: { id: c.id }, data: { status: 'cancelled' } });
    const r = (await addSvc(c.id)).data.addComandaItem;
    expect(r.errors[0].code).toBe('COMANDA_NOT_OPEN');
    const nf = (await addSvc('00000000-0000-4000-8000-000000000000')).data.addComandaItem;
    expect(nf.errors[0].code).toBe('NOT_FOUND');
  });

  it('PROFESSIONAL só lê comandas em que tem item e não altera', async () => {
    const c = await openFor();
    await addSvc(c.id); // proA
    const proB = gqlAs(w, w.tokens.proB);
    const proA = gqlAs(w, w.tokens.proA);
    expect((await proB(GET, { id: c.id })).data.comanda).toBeNull();
    expect((await proA(GET, { id: c.id })).data.comanda.id).toBe(c.id);
    await addSvc(c.id, { professionalId: w.members.proB });
    expect((await proB(GET, { id: c.id })).data.comanda.id).toBe(c.id);

    const c2 = await openFor();
    await addSvc(c2.id); // só proA
    const day = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const mine = (await proB(LIST, { f: yesterday, t: tomorrow })).data.comandas;
    expect(mine.map((x: { id: string }) => x.id)).toEqual([c.id]);
    const all = (await att()(LIST, { f: yesterday, t: tomorrow })).data.comandas;
    expect(all.map((x: { id: string }) => x.id).sort()).toEqual([c.id, c2.id].sort());
    expect((await att()(LIST, { f: 'ontem', t: day })).data.comandas).toEqual([]);

    const denied = await proB(ADD_ITEM, {
      i: {
        comandaId: c.id,
        kind: 'service',
        serviceId: w.serviceId,
        professionalId: w.members.proB,
        quantity: 1,
      },
    });
    expect(denied.errors?.length).toBeGreaterThan(0);
    const openDenied = await proB(OPEN, { i: { clientId: w.clientId } });
    expect(openDenied.errors?.length).toBeGreaterThan(0);
  });

  it('outra organização não enxerga a comanda (RLS)', async () => {
    const c = await openFor();
    const other = gqlAs(w, w.tokens.otherAdmin);
    expect((await other(GET, { id: c.id })).data.comanda).toBeNull();
    const r = await other(ADD_ITEM, {
      i: {
        comandaId: c.id,
        kind: 'service',
        serviceId: w.serviceId,
        professionalId: w.members.proA,
        quantity: 1,
      },
    });
    expect(r.data.addComandaItem.errors[0].code).toBe('NOT_FOUND');
  });
});
