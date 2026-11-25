import { adminPrisma } from './setup';
import {
  clearOverrides,
  createPhase10World,
  destroyPhase10World,
  gqlAs,
  setOverrideRow,
  type Phase10World,
} from './helpers/phase10-fixtures';
import { insertBridalGroupRow } from './helpers/phase4-fixtures';

const GROUPS = `query { bridalGroups { id } }`;
const CONTRACTS = `query { contracts { id } }`;
const UPDATE_SETTINGS = `mutation { updateContractSettings(input: { balanceDueDaysBefore: 7 }) { __typename } }`;
const GROUP_RATE = `query($id: UUID!) { bridalGroup(id: $id) { id assistantDailyRate } }`;

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];
const code = (res: { errors?: GqlErrors }) => res.errors?.[0]?.extensions?.code;

describe('10 — acesso por item: noivas e contratos', () => {
  let w: Phase10World;
  let groupId: string;

  beforeAll(async () => {
    w = await createPhase10World('p10bridal');
    const g = await insertBridalGroupRow(w, { eventDate: '2030-06-15' });
    groupId = g.groupId;
    await adminPrisma.$executeRawUnsafe(
      `UPDATE members SET is_bridal_assistant = true WHERE id = '${w.members.proA}'::uuid`,
    );
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = '${w.members.proA}'::uuid,
         assistant_daily_rate = '220.00', assistant_linked_at = now()
       WHERE id = '${groupId}'::uuid`,
    );
  });
  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `UPDATE bridal_groups SET assistant_member_id = NULL, assistant_daily_rate = NULL, assistant_linked_at = NULL
        WHERE id = '${groupId}'::uuid`,
    );
    await destroyPhase10World(w);
  });
  afterEach(async () => {
    await clearOverrides(w);
  });

  it('Profissional: bridalGroups negado; ganhando Noivas, lista', async () => {
    const asPro = gqlAs(w, w.tokens.proA);
    expect(code(await asPro(GROUPS))).toBe('ACCESS_DENIED');
    await setOverrideRow(w, w.members.proA, 'noivas', true);
    const ok = await asPro(GROUPS);
    expect(ok.errors).toBeUndefined();
  });

  it('Gerente sem Noivas ainda abre via Contratos; sem os dois, ACCESS_DENIED', async () => {
    const asManager = gqlAs(w, w.tokens.manager);
    await setOverrideRow(w, w.members.manager, 'noivas', false);
    expect((await asManager(GROUPS)).errors).toBeUndefined();
    expect((await asManager(CONTRACTS)).errors).toBeUndefined();

    await setOverrideRow(w, w.members.manager, 'contratos', false);
    expect(code(await asManager(GROUPS))).toBe('ACCESS_DENIED');
    expect(code(await asManager(CONTRACTS))).toBe('ACCESS_DENIED');
  });

  it('Gerente sem Contratos: updateContractSettings negado', async () => {
    await setOverrideRow(w, w.members.manager, 'contratos', false);
    const res = await gqlAs(w, w.tokens.manager)(UPDATE_SETTINGS);
    expect(code(res)).toBe('ACCESS_DENIED');
  });

  it('assistantDailyRate: Atendente null, com fin-controle ganho vem o valor, Gerente vê', async () => {
    const asAtt = gqlAs(w, w.tokens.attendant);
    const before = await asAtt(GROUP_RATE, { id: groupId });
    expect(before.errors).toBeUndefined();
    expect(before.data?.bridalGroup?.assistantDailyRate).toBeNull();

    await setOverrideRow(w, w.members.attendant, 'fin-controle', true);
    const after = await asAtt(GROUP_RATE, { id: groupId });
    expect(after.errors).toBeUndefined();
    expect(after.data?.bridalGroup?.assistantDailyRate).toBe('220.00');

    const mgr = await gqlAs(w, w.tokens.manager)(GROUP_RATE, { id: groupId });
    expect(mgr.data?.bridalGroup?.assistantDailyRate).toBe('220.00');
  });
});
