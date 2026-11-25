import { PushProcessor } from './push.processor';
import { PushService } from './push.service';
import type { PushJob, PushProvider, PushSendResult } from './push.types';

// Fase 10: o acesso efetivo tem teste próprio; aqui todo mundo tem o item ligado.
jest.mock('../authz/access/access.service', () => ({
  membersWithItemTx: jest.fn(async (_tx: unknown, ids: string[]) => new Set(ids)),
}));

const START = new Date('2030-05-03T13:00:00Z');

function setup(opts: {
  enabled?: boolean;
  send?: (token: string) => Promise<PushSendResult>;
  tokens?: { id: string; memberId: string; token: string }[];
  appointments?: unknown[];
}) {
  const tx = {
    organization: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }) },
    appointment: {
      findMany: jest.fn().mockResolvedValue(
        opts.appointments ?? [
          {
            id: 'a1',
            professionalId: 'proA',
            startsAt: START,
            professional: { displayName: 'Ana' },
            client: { fullName: 'Cliente Teste' },
            service: { name: 'Corte' },
            bridalGroup: null,
          },
        ],
      ),
    },
    member: {
      findMany: jest
        .fn()
        .mockImplementation((args: { where: { id?: unknown } }) =>
          Promise.resolve(args.where.id ? [{ id: 'proA' }] : [{ id: 'adm' }]),
        ),
    },
    deviceToken: {
      findMany: jest.fn().mockResolvedValue(
        opts.tokens ?? [
          { id: 'd1', memberId: 'proA', token: 't1' },
          { id: 'd2', memberId: 'adm', token: 't2' },
          { id: 'd3', memberId: 'adm', token: 't3' },
        ],
      ),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    notification: { create: jest.fn(), createMany: jest.fn(), upsert: jest.fn() },
  };
  const tenant = { runWithTenant: jest.fn((_o: string, fn: (t: unknown) => unknown) => fn(tx)) };
  const send = jest.fn(opts.send ?? (async () => ({ status: 'sent' }) as PushSendResult));
  const provider: PushProvider = { enabled: opts.enabled ?? true, send };
  const service = new PushService(tenant as never, provider);
  return { tx, tenant, send, service };
}

const CREATED: PushJob = {
  kind: 'appointment.created',
  orgId: 'o1',
  actorMemberId: 'atendente',
  appointmentIds: ['a1'],
};

describe('PushService.dispatch', () => {
  it('sem provedor habilitado não lê o banco', async () => {
    const { service, tenant, send } = setup({ enabled: false });
    const r = await service.dispatch(CREATED);
    expect(r.skipped).toBe('disabled');
    expect(tenant.runWithTenant).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('envia para a profissional e para a gestora, sem criar notificações', async () => {
    const { service, send, tx } = setup({});
    const r = await service.dispatch(CREATED);
    expect(r.sent).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
    const body = (t: string) =>
      ((send.mock.calls.find((c) => c[0] === t) as unknown[])[1] as { body: string }).body;
    expect(body('t1')).not.toContain('(com ');
    expect(body('t2')).toContain('(com Ana)');
    expect(body('t3')).toContain('(com Ana)');
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
    expect(tx.notification.upsert).not.toHaveBeenCalled();
  });

  it('o mesmo token em dois membros é enviado uma vez', async () => {
    const { service, send } = setup({
      tokens: [
        { id: 'd1', memberId: 'proA', token: 'dup' },
        { id: 'd2', memberId: 'adm', token: 'dup' },
      ],
    });
    await service.dispatch(CREATED);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('apaga token inválido', async () => {
    const { service, tx } = setup({
      send: async (t) =>
        t === 't2' ? { status: 'invalid_token', reason: 'UNREGISTERED' } : { status: 'sent' },
    });
    const r = await service.dispatch(CREATED);
    expect(r.invalid).toBe(1);
    expect(tx.deviceToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['d2'] } } });
  });

  it('lança quando todos os envios falham de forma re-tentável', async () => {
    const { service } = setup({
      send: async () => ({ status: 'failed', retryable: true, reason: 'timeout' }),
    });
    await expect(service.dispatch(CREATED)).rejects.toThrow('Push indisponível: nova tentativa');
  });

  it('falha parcial não lança', async () => {
    const { service } = setup({
      tokens: [
        { id: 'd1', memberId: 'proA', token: 't1' },
        { id: 'd2', memberId: 'adm', token: 't2' },
      ],
      send: async (t) =>
        t === 't1' ? { status: 'sent' } : { status: 'failed', retryable: true, reason: 'x' },
    });
    const r = await service.dispatch(CREATED);
    expect(r).toMatchObject({ sent: 1, failed: 1 });
  });

  it('bridal.cancelled com groupId filtra por autor, data e grupo', async () => {
    const { service, tx } = setup({});
    const since = '2030-05-01T10:00:00.000Z';
    await service.dispatch({
      kind: 'bridal.cancelled',
      orgId: 'o1',
      actorMemberId: 'atendente',
      since,
      groupId: 'g1',
    });
    expect(tx.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'cancelled',
          cancelledBy: 'atendente',
          cancelledAt: { gte: new Date(since) },
          bridalGroupId: 'g1',
        },
      }),
    );
  });

  it('bridal.cancelled sem escopo não consulta', async () => {
    const { service, tenant } = setup({});
    const r = await service.dispatch({
      kind: 'bridal.cancelled',
      orgId: 'o1',
      actorMemberId: 'atendente',
      since: '2030-05-01T10:00:00.000Z',
    });
    expect(r.skipped).toBe('no-scope');
    expect(tenant.runWithTenant).not.toHaveBeenCalled();
  });
});

describe('PushProcessor', () => {
  it('delega o job ao PushService.dispatch', async () => {
    const dispatch = jest.fn().mockResolvedValue({ sent: 1 });
    const p = new PushProcessor({ dispatch } as never);
    await p.process({ data: CREATED } as never);
    expect(dispatch).toHaveBeenCalledWith(CREATED);
  });
});
