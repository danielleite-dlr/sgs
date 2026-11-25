import { Logger } from '@nestjs/common';
import { PushService } from './push.service';
import type { PushJob, PushProvider, PushSendResult } from './push.types';

// Fase 10: o acesso efetivo tem teste próprio; aqui todo mundo tem o item ligado.
jest.mock('../authz/access/access.service', () => ({
  membersWithItemTx: jest.fn(async (_tx: unknown, ids: string[]) => new Set(ids)),
}));

const START = new Date('2030-05-03T13:00:00Z');
const ENDPOINT = 'https://web.push.apple.com/endpoint-muito-secreto-123456';
const KEYS = { p256dh: 'B' + 'a'.repeat(86), auth: 'c'.repeat(22) };

type Tok = {
  id: string;
  memberId: string;
  token: string;
  provider: string;
  p256dh: string | null;
  auth: string | null;
};
const FCM_TOK: Tok = {
  id: 'd1',
  memberId: 'proA',
  token: 'fcm-1',
  provider: 'fcm',
  p256dh: null,
  auth: null,
};
const WEB_TOK: Tok = { id: 'd2', memberId: 'proA', token: ENDPOINT, provider: 'webpush', ...KEYS };

const CREATED: PushJob = {
  kind: 'appointment.created',
  orgId: 'o1',
  actorMemberId: 'atendente',
  appointmentIds: ['a1'],
};

function provider(enabled: boolean, result?: PushSendResult) {
  const send = jest.fn(async (..._a: unknown[]): Promise<PushSendResult> => {
    return result ?? { status: 'sent' };
  });
  return { enabled, send } as PushProvider & { send: jest.Mock };
}

function setup(opts: { fcm: PushProvider; web?: PushProvider; tokens?: Tok[] }) {
  const tx = {
    organization: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }) },
    appointment: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'a1',
          professionalId: 'proA',
          startsAt: START,
          professional: { displayName: 'Ana' },
          client: { fullName: 'Cliente Teste' },
          service: { name: 'Corte' },
          bridalGroup: null,
        },
      ]),
    },
    member: {
      findMany: jest
        .fn()
        .mockImplementation((args: { where: { id?: unknown } }) =>
          Promise.resolve(args.where.id ? [{ id: 'proA' }] : []),
        ),
    },
    deviceToken: {
      findMany: jest.fn().mockResolvedValue(opts.tokens ?? [FCM_TOK, WEB_TOK]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const tenant = { runWithTenant: jest.fn((_o: string, fn: (t: unknown) => unknown) => fn(tx)) };
  const service = new PushService(tenant as never, opts.fcm, opts.web);
  return { tx, tenant, service };
}

describe('PushService.dispatch com dois canais', () => {
  afterEach(() => jest.restoreAllMocks());

  it('envia a mesma mensagem por FCM e Web Push, cada um pelo seu provider', async () => {
    const fcm = provider(true);
    const web = provider(true);
    const { service, tx } = setup({ fcm, web });
    const r = await service.dispatch(CREATED);
    expect(r).toMatchObject({ sent: 2, invalid: 0, failed: 0 });
    expect(tx.deviceToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ provider: { in: ['fcm', 'webpush'] } }),
      }),
    );
    expect(fcm.send).toHaveBeenCalledTimes(1);
    expect(fcm.send.mock.calls[0]).toHaveLength(2);
    expect(fcm.send.mock.calls[0][0]).toBe('fcm-1');
    expect(web.send).toHaveBeenCalledTimes(1);
    expect(web.send.mock.calls[0][0]).toBe(ENDPOINT);
    expect(web.send.mock.calls[0][2]).toEqual(KEYS);
    expect(web.send.mock.calls[0][1]).toEqual(fcm.send.mock.calls[0][1]);
  });

  it('Web Push desligado consulta só fcm e não envia webpush', async () => {
    const fcm = provider(true);
    const web = provider(false);
    const { service, tx } = setup({ fcm, web, tokens: [FCM_TOK] });
    await service.dispatch(CREATED);
    expect(tx.deviceToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ provider: { in: ['fcm'] } }) }),
    );
    expect(web.send).not.toHaveBeenCalled();
    expect(fcm.send).toHaveBeenCalledTimes(1);
  });

  it('Web Push ausente (2 argumentos) funciona como desligado', async () => {
    const { service, tx } = setup({ fcm: provider(true), tokens: [FCM_TOK] });
    await service.dispatch(CREATED);
    expect(tx.deviceToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ provider: { in: ['fcm'] } }) }),
    );
  });

  it('FCM desligado e Web Push ligado envia só webpush', async () => {
    const fcm = provider(false);
    const web = provider(true);
    const { service } = setup({ fcm, web, tokens: [WEB_TOK] });
    const r = await service.dispatch(CREATED);
    expect(r.sent).toBe(1);
    expect(fcm.send).not.toHaveBeenCalled();
    expect(web.send).toHaveBeenCalledTimes(1);
  });

  it('os dois desligados pula sem ler o banco', async () => {
    const { service, tenant } = setup({ fcm: provider(false), web: provider(false) });
    const r = await service.dispatch(CREATED);
    expect(r).toEqual({ sent: 0, invalid: 0, failed: 0, skipped: 'disabled' });
    expect(tenant.runWithTenant).not.toHaveBeenCalled();
  });

  it('invalid_token do Web Push entra no deleteMany', async () => {
    const web = provider(true, { status: 'invalid_token', reason: 'WebPush 410' });
    const { service, tx } = setup({ fcm: provider(true), web });
    const r = await service.dispatch(CREATED);
    expect(r.invalid).toBe(1);
    expect(tx.deviceToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['d2'] } } });
  });

  it('todos retentáveis lança; falha parcial não lança', async () => {
    const retry: PushSendResult = { status: 'failed', retryable: true, reason: 'rede' };
    const all = setup({ fcm: provider(true, retry), web: provider(true, retry) });
    await expect(all.service.dispatch(CREATED)).rejects.toThrow(
      'Push indisponível: nova tentativa',
    );

    const partial = setup({ fcm: provider(true), web: provider(true, retry) });
    await expect(partial.service.dispatch(CREATED)).resolves.toMatchObject({ sent: 1, failed: 1 });
  });

  it('logs nunca trazem o endpoint inteiro nem as chaves', async () => {
    const spies = [
      jest.spyOn(Logger.prototype, 'log').mockImplementation(),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(),
      jest.spyOn(Logger.prototype, 'error').mockImplementation(),
    ];
    const cred: PushSendResult = {
      status: 'failed',
      retryable: false,
      reason: 'erro de credencial VAPID (403)',
    };
    const gone: PushSendResult = { status: 'invalid_token', reason: 'WebPush 410' };
    for (const res of [cred, gone]) {
      const { service } = setup({ fcm: provider(true), web: provider(true, res) });
      await service.dispatch(CREATED);
    }
    const all = spies.flatMap((s) => s.mock.calls.map((c) => c.map(String).join(' '))).join('\n');
    expect(all).toContain('Falha de credencial Web Push');
    expect(all).not.toContain(ENDPOINT);
    expect(all).not.toContain(KEYS.p256dh);
    expect(all).not.toContain(KEYS.auth);
  });
});
