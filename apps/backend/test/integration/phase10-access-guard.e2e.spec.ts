import { adminPrisma } from './setup';
import {
  clearOverrides,
  createPhase10World,
  destroyPhase10World,
  gqlAs,
  setOverrideRow,
  type Phase10World,
} from './helpers/phase10-fixtures';

const FORECAST = `query { cashForecast(from: "2026-11-01", to: "2026-12-01") { from to } }`;
const SUMMARY = `query { financialSummary(from: "2026-11-01", to: "2026-12-01", granularity: "day") { __typename } }`;
const COMANDAS = `query { comandas(from: "2026-11-01", to: "2026-12-01") { id } }`;
type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
function firstError(res: { errors?: GqlErrors }) {
  return res.errors?.[0];
}

describe('10 — guard de acesso por pessoa', () => {
  let w: Phase10World;

  beforeAll(async () => {
    w = await createPhase10World('p10guard');
  });
  afterAll(async () => {
    await destroyPhase10World(w);
  });

  afterEach(async () => {
    await clearOverrides(w);
    const roles = await adminPrisma.role.findMany({
      where: { isSystem: true, name: { in: ['MANAGER', 'ATTENDANT', 'PROFESSIONAL'] } },
    });
    const byName = (n: string) => roles.find((r) => r.name === n)!.id;
    await adminPrisma.member.update({
      where: { id: w.members.manager },
      data: { status: 'active', roleId: byName('MANAGER') },
    });
    await adminPrisma.member.update({
      where: { id: w.members.attendant },
      data: { status: 'active', roleId: byName('ATTENDANT') },
    });
  });

  it('negar fin-previsao ao Gerente vale na próxima chamada, com o mesmo token', async () => {
    const asManager = gqlAs(w, w.tokens.manager);
    const before = await asManager(FORECAST);
    expect(before.errors).toBeUndefined();

    await setOverrideRow(w, w.members.manager, 'fin-previsao', false);
    const denied = await asManager(FORECAST);
    const e = firstError(denied);
    expect(e?.extensions?.code).toBe('ACCESS_DENIED');
    expect(e?.message).toMatch(/^FORBIDDEN:/);

    await clearOverrides(w);
    const after = await asManager(FORECAST);
    expect(after.errors).toBeUndefined();
  });

  it('Atendente: padrão desligado; ganhar fin-previsao libera com o mesmo token', async () => {
    const asAtt = gqlAs(w, w.tokens.attendant);
    const denied = await asAtt(FORECAST);
    expect(firstError(denied)?.extensions?.code).toBe('ACCESS_DENIED');

    await setOverrideRow(w, w.members.attendant, 'fin-previsao', true);
    const ok = await asAtt(FORECAST);
    expect(ok.errors).toBeUndefined();
  });

  it('Atendente com fin-previsao ganho segue sem financial.read em operação sem @RequireAccess', async () => {
    await setOverrideRow(w, w.members.attendant, 'fin-previsao', true);
    const res = await gqlAs(w, w.tokens.attendant)(SUMMARY);
    const e = firstError(res);
    expect(e?.extensions?.code).toBe('ACCESS_DENIED');
    expect(e?.message).toMatch(/^FORBIDDEN: missing permissions \[financial\.read\]/);
  });

  it('Profissional chamando comandas (sem @RequireAccess) continua ok', async () => {
    const res = await gqlAs(w, w.tokens.proA)(COMANDAS);
    expect(res.errors).toBeUndefined();
  });

  it('membro desativado é recusado mesmo com token válido', async () => {
    const asManager = gqlAs(w, w.tokens.manager);
    await adminPrisma.member.update({
      where: { id: w.members.manager },
      data: { status: 'inactive' },
    });
    const res = await asManager(FORECAST);
    const e = firstError(res);
    expect(e?.extensions?.code).toBe('FORBIDDEN');
    expect(e?.message).toMatch(/^FORBIDDEN: membro inativo/);
  });

  it('papel trocado no banco vale com o mesmo token', async () => {
    const asManager = gqlAs(w, w.tokens.manager);
    expect((await asManager(FORECAST)).errors).toBeUndefined();
    const att = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ATTENDANT', isSystem: true },
    });
    await adminPrisma.member.update({
      where: { id: w.members.manager },
      data: { roleId: att.id },
    });
    const res = await asManager(FORECAST);
    expect(firstError(res)?.extensions?.code).toBe('ACCESS_DENIED');
  });
});
