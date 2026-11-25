import { adminPrisma } from './setup';
import { gqlAs } from './helpers/phase4-fixtures';
import {
  createPhase91World,
  destroyPhase91World,
  insertStudioBrideGroup,
  type Phase91World,
} from './helpers/phase91-fixtures';

const PKG = `
  package { id price includesBridalAssistant bridalAssistantDailyCost totalCost profit }
  errors { code message field }`;
const CREATE = `mutation($i: CreatePackageInput!) { createPackage(input: $i) { ${PKG} } }`;
const UPDATE = `mutation($i: UpdatePackageInput!) { updatePackage(input: $i) { ${PKG} } }`;
const GET = `query($id: UUID!) { package(id: $id) { id price includesBridalAssistant bridalAssistantDailyCost totalCost profit } }`;
const SETTINGS = `query { bridalAssistantSettings { dailyRate } }`;
const SET_RATE = `mutation($r: String!) { updateBridalAssistantSettings(dailyRate: $r) {
  settings { dailyRate } errors { code message field } } }`;

describe('09.1 — pacote com assistente e diária', () => {
  let w: Phase91World;
  let pkgId: string;
  const ORGS = `SELECT id FROM organizations WHERE legal_name LIKE 'p91p-%'`;

  const as = (t: string) => gqlAs(w, t);

  beforeAll(async () => {
    w = await createPhase91World('p91p');
  });
  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM package_cost_items WHERE organization_id IN (${ORGS})`,
    );
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM contract_settings WHERE organization_id IN (${ORGS})`,
    );
    await destroyPhase91World(w);
  });

  it('ADMIN cria pacote com assistente: custo soma a diária de 220.00', async () => {
    const r = await as(w.tokens.admin)(CREATE, {
      i: {
        name: 'p91p-pacote-assist',
        price: '1000.00',
        services: [{ serviceId: w.serviceId }],
        costItems: [{ name: 'Extra', cost: '50.00' }],
        includesBridalAssistant: true,
      },
    });
    expect(r.errors).toBeUndefined();
    const p = r.data.createPackage;
    expect(p.errors).toEqual([]);
    pkgId = p.package.id;
    expect(p.package.includesBridalAssistant).toBe(true);
    expect(p.package.bridalAssistantDailyCost).toBe('220.00');
    expect(p.package.totalCost).toBe('270.00');
    expect(p.package.profit).toBe('730.00');
  });

  it('ATTENDANT lê a flag mas não vê diária nem custo', async () => {
    const r = await as(w.tokens.attendant)(GET, { id: pkgId });
    expect(r.errors).toBeUndefined();
    expect(r.data.package.includesBridalAssistant).toBe(true);
    expect(r.data.package.bridalAssistantDailyCost).toBeNull();
    expect(r.data.package.totalCost).toBeNull();
  });

  it('bridalAssistantSettings devolve 220.00 para ADMIN, MANAGER e ATTENDANT', async () => {
    for (const t of [w.tokens.admin, w.tokens.manager, w.tokens.attendant]) {
      const r = await as(t)(SETTINGS);
      expect(r.errors).toBeUndefined();
      expect(r.data.bridalAssistantSettings.dailyRate).toBe('220.00');
    }
  });

  it('snapshot do vínculo não muda com o reajuste da diária (D-08)', async () => {
    const g = await insertStudioBrideGroup(w, { eventDate: '2030-07-20' });
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = '${w.assistants.a}'::uuid,
         assistant_daily_rate = 220.00, assistant_linked_at = now()
       WHERE id = '${g.groupId}'::uuid`,
    );

    const r = await as(w.tokens.manager)(SET_RATE, { r: '250,00' });
    expect(r.errors).toBeUndefined();
    expect(r.data.updateBridalAssistantSettings.errors).toEqual([]);
    expect(r.data.updateBridalAssistantSettings.settings.dailyRate).toBe('250.00');

    const rows = await adminPrisma.$queryRawUnsafe<Array<{ assistant_daily_rate: unknown }>>(
      `SELECT assistant_daily_rate FROM bridal_groups WHERE id = '${g.groupId}'::uuid`,
    );
    expect(Number(rows[0].assistant_daily_rate).toFixed(2)).toBe('220.00');
  });

  it('nova diária muda o custo do pacote, mas não o preço', async () => {
    const r = await as(w.tokens.admin)(GET, { id: pkgId });
    expect(r.data.package.bridalAssistantDailyCost).toBe('250.00');
    expect(r.data.package.totalCost).toBe('300.00');
    expect(Number(r.data.package.price)).toBe(1000);
  });

  it('ATTENDANT e PROFESSIONAL não alteram a diária (FORBIDDEN)', async () => {
    for (const t of [w.tokens.attendant, w.tokens.proA]) {
      const r = await as(t)(SET_RATE, { r: '300.00' });
      expect(r.errors?.length).toBeGreaterThan(0);
      expect(JSON.stringify(r.errors)).toMatch(/FORBIDDEN/i);
    }
    const r = await as(w.tokens.admin)(SETTINGS);
    expect(r.data.bridalAssistantSettings.dailyRate).toBe('250.00');
  });

  it('valor fora da faixa é recusado com INVALID_DAILY_RATE', async () => {
    for (const bad of ['-1', '100000', 'abc', '10.999']) {
      const r = await as(w.tokens.manager)(SET_RATE, { r: bad });
      expect(r.errors).toBeUndefined();
      expect(r.data.updateBridalAssistantSettings.errors[0].code).toBe('INVALID_DAILY_RATE');
      expect(r.data.updateBridalAssistantSettings.settings).toBeNull();
    }
  });

  it('desmarcar a assistente tira a diária do custo', async () => {
    const r = await as(w.tokens.admin)(UPDATE, {
      i: { id: pkgId, includesBridalAssistant: false },
    });
    expect(r.errors).toBeUndefined();
    const p = r.data.updatePackage.package;
    expect(p.includesBridalAssistant).toBe(false);
    expect(p.bridalAssistantDailyCost).toBeNull();
    expect(p.totalCost).toBe('50.00');
  });
});
