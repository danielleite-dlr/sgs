import { adminPrisma } from './setup';
import {
  clearOverrides,
  createPhase10World,
  destroyPhase10World,
  gqlAs,
  setOverrideRow,
  type Phase10World,
} from './helpers/phase10-fixtures';
import { deletePhase3Rows } from './helpers/phase3-cleanup';
import { ADD_ITEM, ADD_PAY, CLOSE, OPEN, range } from './helpers/phase3-comanda-flow';

const FORECAST = `query { cashForecast(from: "2026-11-01", to: "2026-12-01") { from to } }`;
const SUMMARY = `query { financialSummary(from: "2026-11-01", to: "2026-12-01", granularity: "day") { __typename } }`;
const COMANDAS = `query { comandas(from: "2026-11-01", to: "2026-12-01") { id } }`;
const CLIENTS = `query { clients(limit: 5) { __typename } }`;
const UPDATE_CLIENT = `mutation($i: UpdateClientInput!) { updateClient(input: $i) { __typename } }`;
const CREATE_CLIENT = `mutation($i: CreateClientInput!) { createClient(input: $i) { __typename } }`;
const PACKAGE_COSTS = `query($id: UUID!) { package(id: $id) { id totalCost profit costItems { id } } }`;
const COMMISSION_TOTALS = `query($f: String!, $t: String!) {
  commissionTotals(from: $f, to: $t) { memberId records }
}`;
const CATEGORIES = `query { categories { __typename } }`;
const CREATE_CATEGORY = `mutation($i: CreateCategoryInput!) { createCategory(input: $i) { __typename } }`;
const LOW_STOCK = `query { lowStockCount }`;
const ADJUST_STOCK = `mutation($i: AdjustStockInput!) { adjustStock(input: $i) { __typename } }`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
const code = (res: { errors?: GqlErrors }) => res.errors?.[0]?.extensions?.code;

describe('10 — acesso por item: operações e catálogo', () => {
  let w: Phase10World;

  beforeAll(async () => {
    w = await createPhase10World('p10ops');
  });
  afterAll(async () => {
    await deletePhase3Rows(`SELECT id FROM organizations WHERE legal_name LIKE 'p10ops-%'`);
    await adminPrisma.commissionRule.deleteMany({ where: { organizationId: w.orgId } });
    await destroyPhase10World(w);
  });
  afterEach(async () => {
    await clearOverrides(w);
  });

  it('Gerente sem fin-controle: financialSummary negado, cashForecast segue (D-06)', async () => {
    await setOverrideRow(w, w.members.manager, 'fin-controle', false);
    const asManager = gqlAs(w, w.tokens.manager);
    expect(code(await asManager(SUMMARY))).toBe('ACCESS_DENIED');
    expect((await asManager(FORECAST)).errors).toBeUndefined();
  });

  it('Atendente sem fin-comandas: comandas negado, clientes segue pela agenda', async () => {
    await setOverrideRow(w, w.members.attendant, 'fin-comandas', false);
    const asAtt = gqlAs(w, w.tokens.attendant);
    expect(code(await asAtt(COMANDAS))).toBe('ACCESS_DENIED');
    expect((await asAtt(CLIENTS)).errors).toBeUndefined();
  });

  it('Profissional sem agenda ainda lê clientes pela comanda; sem as três, é negado', async () => {
    const asPro = gqlAs(w, w.tokens.proA);
    await setOverrideRow(w, w.members.proA, 'agenda', false);
    expect((await asPro(CLIENTS)).errors).toBeUndefined();

    await setOverrideRow(w, w.members.proA, 'clientes-todos', false);
    await setOverrideRow(w, w.members.proA, 'fin-comandas', false);
    expect(code(await asPro(CLIENTS))).toBe('ACCESS_DENIED');
  });

  it('Atendente sem clientes-todos: não edita cliente, mas cria no cadastro rápido', async () => {
    await setOverrideRow(w, w.members.attendant, 'clientes-todos', false);
    const asAtt = gqlAs(w, w.tokens.attendant);
    const upd = await asAtt(UPDATE_CLIENT, { i: { id: w.clientId, fullName: 'Outro Nome' } });
    expect(code(upd)).toBe('ACCESS_DENIED');
    const created = await asAtt(CREATE_CLIENT, { i: { fullName: 'p10ops Cadastro Rápido' } });
    expect(created.errors).toBeUndefined();
  });

  it('custos do pacote: null sem ganho; visíveis com fin-controle (PERM-07)', async () => {
    const asAtt = gqlAs(w, w.tokens.attendant);
    const before = await asAtt(PACKAGE_COSTS, { id: w.packageId });
    expect(before.errors).toBeUndefined();
    expect(before.data.package.totalCost).toBeNull();
    expect(before.data.package.profit).toBeNull();
    expect(before.data.package.costItems).toBeNull();

    await setOverrideRow(w, w.members.attendant, 'fin-controle', true);
    const after = await asAtt(PACKAGE_COSTS, { id: w.packageId });
    expect(after.errors).toBeUndefined();
    expect(after.data.package.totalCost).not.toBeNull();
    expect(after.data.package.profit).not.toBeNull();
    expect(after.data.package.costItems).not.toBeNull();
  });

  it('comissões: Profissional só as próprias; Atendente com fin-comissoes vê todas', async () => {
    await adminPrisma.commissionRule.create({
      data: {
        organizationId: w.orgId,
        scopeType: 'service',
        serviceId: w.serviceId,
        kind: 'percentage',
        value: '40',
      } as never,
    });
    // Uma comanda fechada para cada profissional (fluxo real de fechamento).
    const att = gqlAs(w, w.tokens.attendant);
    for (const pro of [w.members.proA, w.members.proB]) {
      const open = await att(OPEN, { i: { clientId: w.clientId } });
      const id = open.data.openWalkInComanda.comanda.id as string;
      await att(ADD_ITEM, {
        i: { comandaId: id, kind: 'service', serviceId: w.serviceId, professionalId: pro, quantity: 1 },
      });
      await att(ADD_PAY, { i: { comandaId: id, method: 'pix', amount: '100.00' } });
      const closed = await att(CLOSE, { id });
      expect(closed.data.closeComanda.errors).toEqual([]);
    }
    const { from, to } = range();

    const asPro = await gqlAs(w, w.tokens.proA)(COMMISSION_TOTALS, { f: from, t: to });
    expect(asPro.errors).toBeUndefined();
    const proIds = (asPro.data.commissionTotals as { memberId: string }[]).map((r) => r.memberId);
    expect(proIds.length).toBeGreaterThan(0);
    expect(new Set(proIds)).toEqual(new Set([w.members.proA]));

    expect(code(await att(COMMISSION_TOTALS, { f: from, t: to }))).toBe('ACCESS_DENIED');
    await setOverrideRow(w, w.members.attendant, 'fin-comissoes', true);
    const asAtt = await att(COMMISSION_TOTALS, { f: from, t: to });
    expect(asAtt.errors).toBeUndefined();
    const attIds = new Set(
      (asAtt.data.commissionTotals as { memberId: string }[]).map((r) => r.memberId),
    );
    expect(attIds.size).toBeGreaterThan(1);
  });

  it('Gerente sem categorias: cria categoria negado, lista segue (CATALOGO_REF)', async () => {
    await setOverrideRow(w, w.members.manager, 'categorias', false);
    const asManager = gqlAs(w, w.tokens.manager);
    expect(code(await asManager(CREATE_CATEGORY, { i: { name: 'p10ops cat' } }))).toBe(
      'ACCESS_DENIED',
    );
    expect((await asManager(CATEGORIES)).errors).toBeUndefined();
  });

  it('Gerente sem produtos-todos: lowStockCount e adjustStock negados', async () => {
    await setOverrideRow(w, w.members.manager, 'produtos-todos', false);
    const asManager = gqlAs(w, w.tokens.manager);
    expect(code(await asManager(LOW_STOCK))).toBe('ACCESS_DENIED');
    const adj = await asManager(ADJUST_STOCK, {
      i: { productId: w.clientId, delta: 1, reason: 'teste' },
    });
    expect(code(adj)).toBe('ACCESS_DENIED');
  });
});
