import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase5Rows } from './helpers/phase5-cleanup';

const FIELDS = `fixedExpense { id name amount dueDay active } errors { code message field }`;
const CREATE = `mutation($input: FixedExpenseInput!) { createFixedExpense(input: $input) { ${FIELDS} } }`;
const UPDATE = `mutation($id: UUID!, $input: FixedExpenseInput!) { updateFixedExpense(id: $id, input: $input) { ${FIELDS} } }`;
const DELETE = `mutation($id: UUID!) { deleteFixedExpense(id: $id) { ${FIELDS} } }`;
const LIST = `query { fixedExpenses { id name amount dueDay active } }`;

describe('Phase 5 - despesas fixas', () => {
  let w: Phase4World;

  beforeAll(async () => {
    w = await createPhase4World('p5fe');
  }, 90_000);

  afterAll(async () => {
    await deletePhase5Rows(
      `SELECT id FROM organizations WHERE id IN ('${w.orgId}','${w.otherOrgId}')`,
    );
    await destroyPhase4World(w);
  });

  it('ADMIN: cria, lista, atualiza, valida e exclui', async () => {
    const admin = gqlAs(w, w.tokens.admin);

    const created = await admin(CREATE, {
      input: { name: 'Aluguel', amount: '1500.00', dueDay: 10 },
    });
    expect(created.data.createFixedExpense.errors).toEqual([]);
    const fe = created.data.createFixedExpense.fixedExpense;
    expect(fe).toMatchObject({ name: 'Aluguel', amount: '1500.00', dueDay: 10, active: true });

    const list = await admin(LIST);
    expect(list.data.fixedExpenses.map((x: { id: string }) => x.id)).toContain(fe.id);

    const upd = await admin(UPDATE, {
      id: fe.id,
      input: { name: 'Aluguel do estúdio', amount: '1600.50', dueDay: 31, active: false },
    });
    expect(upd.data.updateFixedExpense.errors).toEqual([]);
    expect(upd.data.updateFixedExpense.fixedExpense).toMatchObject({
      name: 'Aluguel do estúdio',
      amount: '1600.50',
      dueDay: 31,
      active: false,
    });

    const code = async (input: Record<string, unknown>) =>
      (await admin(CREATE, { input })).data.createFixedExpense.errors[0]?.code;
    expect(await code({ name: 'A', amount: '10.00', dueDay: 5 })).toBe('INVALID_NAME');
    expect(await code({ name: 'Luz', amount: '0', dueDay: 5 })).toBe('INVALID_AMOUNT');
    expect(await code({ name: 'Luz', amount: '12,50', dueDay: 5 })).toBe('INVALID_AMOUNT');
    expect(await code({ name: 'Luz', amount: '10.00', dueDay: 0 })).toBe('INVALID_DUE_DAY');
    expect(await code({ name: 'Luz', amount: '10.00', dueDay: 32 })).toBe('INVALID_DUE_DAY');

    const del = await admin(DELETE, { id: fe.id });
    expect(del.data.deleteFixedExpense.errors).toEqual([]);
    expect(del.data.deleteFixedExpense.fixedExpense.id).toBe(fe.id);
    const again = await admin(DELETE, { id: fe.id });
    expect(again.data.deleteFixedExpense.errors[0].code).toBe('NOT_FOUND');
  });

  it('MANAGER também cria', async () => {
    const mgr = gqlAs(w, w.tokens.manager);
    const res = await mgr(CREATE, { input: { name: 'Internet', amount: '99.90', dueDay: 15 } });
    expect(res.data.createFixedExpense.errors).toEqual([]);
    expect(res.data.createFixedExpense.fixedExpense.amount).toBe('99.90');
  });
});
