import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';

/** Garante que o mundo compartilhado das suites da Fase 3 sobe, loga e limpa. */
const Q = `query($s: UUID!) { professionalsForService(serviceId: $s) { id } }`;

describe('Phase 3 fixtures', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p3fix');
  });

  afterAll(async () => {
    await destroyPhase3World(w);
  });

  it('cria tokens funcionais para cada papel', async () => {
    const res = await gqlAs(w, w.tokens.admin)(Q, { s: w.serviceId });
    expect(res.errors).toBeUndefined();
    const mine = (res.data.professionalsForService as { id: string }[]).map((m) => m.id);
    expect(mine.sort()).toEqual([w.members.proA, w.members.proB].sort());
    const other = await gqlAs(w, w.tokens.otherAdmin)(Q, { s: w.serviceId });
    const ids = (other.data.professionalsForService as { id: string }[]).map((m) => m.id);
    expect(ids).not.toContain(w.members.proA);
  });

  it('cria catalogo com os valores esperados', async () => {
    expect(w.serviceId && w.serviceBId && w.variantId && w.productId && w.packageId).toBeTruthy();
  });
});
