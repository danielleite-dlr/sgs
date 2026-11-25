import { AccessService, membersWithItemTx } from './access.service';

const ORG = '11111111-1111-4111-8111-111111111111';

function row(
  id: string,
  role: string,
  perms: string[],
  overrides: { itemId: string; enabled: boolean }[] = [],
) {
  return {
    id,
    role: {
      name: role,
      permissions: perms.map((permission) => ({ permission })),
    },
    accessOverrides: overrides,
  };
}

function fakeTenant(tx: unknown) {
  const runWithTenant = jest.fn(
    async (_org: string, fn: (t: unknown) => Promise<unknown>) => fn(tx),
  );
  return { runWithTenant };
}

describe('AccessService', () => {
  it('memoiza por requisição: 3 chamadas, 1 leitura', async () => {
    const tx = {
      member: {
        findFirst: jest
          .fn()
          .mockResolvedValue(row('m1', 'MANAGER', ['financial.read'])),
      },
    };
    const tenant = fakeTenant(tx);
    const svc = new AccessService(tenant as never);
    const ctx = {
      tenant: { organizationId: ORG, memberId: 'm1', roleName: 'X' },
    };
    const [a, b, c] = await Promise.all([
      svc.forContext(ctx),
      svc.forContext(ctx),
      svc.forContext(ctx),
    ]);
    expect(tenant.runWithTenant).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a?.roleName).toBe('MANAGER');
  });

  it('devolve null para membro inexistente, inativo ou excluído', async () => {
    const tx = { member: { findFirst: jest.fn().mockResolvedValue(null) } };
    const svc = new AccessService(fakeTenant(tx) as never);
    expect(await svc.load(ORG, 'm1')).toBeNull();
    const where = tx.member.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'active', deletedAt: null });
  });

  it('membersWithItem devolve só quem tem o item ligado', async () => {
    const tx = {
      member: {
        findMany: jest.fn().mockResolvedValue([
          row('a', 'ATTENDANT', ['commercial.read']),
          row('b', 'ATTENDANT', ['commercial.read'], [
            { itemId: 'comercial-lembretes', enabled: false },
          ]),
          row('c', 'MANAGER', ['commercial.read']),
        ]),
      },
    };
    const svc = new AccessService(fakeTenant(tx) as never);
    const got = await svc.membersWithItem(
      tx as never,
      ['a', 'b', 'c'],
      'comercial-lembretes',
    );
    expect([...got].sort()).toEqual(['a', 'c']);
    expect((await membersWithItemTx(tx as never, [], 'agenda')).size).toBe(0);
  });
});
