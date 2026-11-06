import { randomUUID } from 'node:crypto';
import { appPrisma } from './setup';
import {
  createPhase4World,
  destroyPhase4World,
  gqlAs,
  type Phase4World,
} from './helpers/phase4-fixtures';
import { deletePhase5Rows } from './helpers/phase5-cleanup';

const FIELDS = `fixedExpense { id } errors { code }`;
const CREATE = `mutation($input: FixedExpenseInput!) { createFixedExpense(input: $input) { ${FIELDS} } }`;
const UPDATE = `mutation($id: UUID!, $input: FixedExpenseInput!) { updateFixedExpense(id: $id, input: $input) { ${FIELDS} } }`;
const DELETE = `mutation($id: UUID!) { deleteFixedExpense(id: $id) { ${FIELDS} } }`;
const LIST = `query { fixedExpenses { id } }`;
const INPUT = { name: 'Aluguel', amount: '1500.00', dueDay: 10 };

type GqlErrors = { message: string; extensions?: Record<string, unknown> }[];

function isForbidden(res: { errors?: GqlErrors }): boolean {
  const e = res.errors?.[0];
  return !!e && /FORBIDDEN/.test(`${e.extensions?.code ?? ''} ${e.message}`);
}

describe('Phase 5 - RLS e RBAC', () => {
  let w: Phase4World;
  let expenseId: string;

  beforeAll(async () => {
    w = await createPhase4World('p5rls');
    const res = await gqlAs(w, w.tokens.admin)(CREATE, { input: INPUT });
    expenseId = res.data.createFixedExpense.fixedExpense.id;
  }, 90_000);

  afterAll(async () => {
    await deletePhase5Rows(
      `SELECT id FROM organizations WHERE id IN ('${w.orgId}','${w.otherOrgId}')`,
    );
    await destroyPhase4World(w);
  });

  describe('fixedExpenses', () => {
    it.each([['attendant'], ['proA']] as const)(
      '%s: não lê nem grava',
      async (role) => {
        const g = gqlAs(w, w.tokens[role]);
        expect(isForbidden(await g(LIST))).toBe(true);
        expect(isForbidden(await g(CREATE, { input: INPUT }))).toBe(true);
        expect(isForbidden(await g(UPDATE, { id: expenseId, input: INPUT }))).toBe(true);
        expect(isForbidden(await g(DELETE, { id: expenseId }))).toBe(true);
      },
    );

    it('otherAdmin não vê a despesa e recebe NOT_FOUND ao alterar', async () => {
      const b = gqlAs(w, w.tokens.otherAdmin);
      expect((await b(LIST)).data.fixedExpenses).toEqual([]);
      const upd = await b(UPDATE, { id: expenseId, input: INPUT });
      expect(upd.data.updateFixedExpense.errors[0].code).toBe('NOT_FOUND');
      const del = await b(DELETE, { id: expenseId });
      expect(del.data.deleteFixedExpense.errors[0].code).toBe('NOT_FOUND');
      // continua existindo para a org dona
      const mine = await gqlAs(w, w.tokens.admin)(LIST);
      expect(mine.data.fixedExpenses.map((x: { id: string }) => x.id)).toContain(expenseId);
    });

    it('sgs_app: org B não enxerga e não insere linhas da org A (RLS)', async () => {
      const seen = await appPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.current_organization', '${w.otherOrgId}', true)`,
        );
        return tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*)::bigint AS n FROM fixed_expenses WHERE organization_id = '${w.orgId}'`,
        );
      });
      expect(Number(seen[0].n)).toBe(0);

      const outcome = await appPrisma
        .$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.current_organization', '${w.otherOrgId}', true)`,
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO fixed_expenses (id, organization_id, name, amount, due_day) VALUES ('${randomUUID()}', '${w.orgId}', 'hack', 1, 1)`,
          );
        })
        .then(() => 'inseriu')
        .catch((e: Error) =>
          /row-level security|violates/i.test(e.message) ? 'bloqueado' : e.message,
        );
      expect(outcome).toBe('bloqueado');
    });
  });

  describe('cashForecast', () => {
    it.todo('preenchido no plano 05-04');
  });
});
