import { buildCommercialReminderMessage, buildReminderRoute } from './push-messages';
import { membersWithItemTx } from '../authz/access/access.service';
import { PushService } from './push.service';
import type { PushJob, PushProvider, PushSendResult } from './push.types';

jest.mock('../authz/access/access.service', () => ({ membersWithItemTx: jest.fn() }));
const withItem = membersWithItemTx as jest.Mock;

const JOB: PushJob = { kind: 'commercial.reminder', orgId: 'o1', reminderId: 'r1' };

describe('buildCommercialReminderMessage', () => {
  it('monta título, corpo e rota com lead, tipo e data do evento', () => {
    const m = buildCommercialReminderMessage(
      { reminderId: 'r1', title: 'Ligar para Ana', leadName: 'Ana', dealKind: 'noiva', eventDate: '2027-05-10' },
      'America/Sao_Paulo',
    );
    expect(m.title).toBe('Lembrete: Ligar para Ana');
    expect(m.body).toBe('Ana · Noiva · 10/05/2027');
    expect(m.data).toEqual({
      kind: 'commercial.reminder',
      route: '/comercial/lembretes?lembrete=r1',
      reminderId: 'r1',
    });
  });

  it('rotula debutante', () => {
    const m = buildCommercialReminderMessage(
      { reminderId: 'r1', title: 'X', leadName: 'Bia', dealKind: 'debutante' },
      'America/Sao_Paulo',
    );
    expect(m.body).toBe('Bia · Debutante');
  });

  it('sem negócio e sem lead usa a descrição (até 140) ou o texto padrão', () => {
    const tz = 'America/Sao_Paulo';
    const longa = 'd'.repeat(300);
    expect(
      buildCommercialReminderMessage({ reminderId: 'r1', title: 'X', description: longa }, tz).body,
    ).toHaveLength(140);
    expect(buildCommercialReminderMessage({ reminderId: 'r1', title: 'X' }, tz).body).toBe(
      'Abra o Comercial para ver o lembrete',
    );
  });

  it('corta o título em 100 caracteres', () => {
    const m = buildCommercialReminderMessage(
      { reminderId: 'r1', title: 't'.repeat(300) },
      'America/Sao_Paulo',
    );
    expect(m.title.length).toBeLessThanOrEqual(100);
  });

  it('buildReminderRoute rejeita id inválido', () => {
    expect(() => buildReminderRoute('a/b')).toThrow();
  });
});

function provider(enabled: boolean) {
  const send = jest.fn(async (..._a: unknown[]): Promise<PushSendResult> => ({ status: 'sent' }));
  return { enabled, send } as PushProvider & { send: jest.Mock };
}

function setup(opts: {
  reminder: unknown;
  managers?: string[];
  eligible?: string[];
  tokens?: { id: string; memberId: string; token: string; provider: string }[];
  fcm?: PushProvider;
}) {
  withItem.mockReset();
  withItem.mockImplementation(async (_tx: unknown, ids: string[]) =>
    new Set(ids.filter((id) => (opts.eligible ?? []).includes(id))),
  );
  const tx = {
    commercialReminder: { findFirst: jest.fn().mockResolvedValue(opts.reminder) },
    organization: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }) },
    member: {
      findMany: jest.fn().mockResolvedValue((opts.managers ?? []).map((id) => ({ id }))),
    },
    deviceToken: {
      findMany: jest
        .fn()
        .mockImplementation((a: { where: { memberId: { in: string[] } } }) =>
          Promise.resolve(
            (opts.tokens ?? [])
              .filter((t) => a.where.memberId.in.includes(t.memberId))
              .map((t) => ({ ...t, p256dh: null, auth: null })),
          ),
        ),
      deleteMany: jest.fn(),
    },
  };
  const tenant = { runWithTenant: jest.fn((_o: string, fn: (t: unknown) => unknown) => fn(tx)) };
  const fcm = opts.fcm ?? provider(true);
  return { tx, fcm, service: new PushService(tenant as never, fcm) };
}

const REMINDER = {
  id: 'r1',
  title: 'Ligar',
  description: null,
  createdBy: 'att',
  deal: {
    assigneeMemberId: 'attB',
    kind: 'noiva',
    eventDate: new Date('2027-05-10T00:00:00Z'),
    lead: { fullName: 'Ana' },
  },
  lead: null,
};

describe('PushService.dispatch commercial.reminder', () => {
  it('envia para responsável e gerentes, uma vez por token', async () => {
    const { service, fcm, tx } = setup({
      reminder: REMINDER,
      managers: ['adm', 'ger'],
      eligible: ['attB', 'adm', 'ger'],
      tokens: [
        { id: 't1', memberId: 'attB', token: 'tok-1', provider: 'fcm' },
        { id: 't2', memberId: 'adm', token: 'tok-1', provider: 'fcm' },
        { id: 't3', memberId: 'ger', token: 'tok-3', provider: 'fcm' },
      ],
    });
    const r = await service.dispatch(JOB);
    expect(r).toMatchObject({ sent: 2, failed: 0 });
    expect(fcm.send).toHaveBeenCalledTimes(2);
    expect(withItem.mock.calls[0][1].slice().sort()).toEqual(['adm', 'attB', 'ger']);
    expect(withItem.mock.calls[0][2]).toBe('comercial-lembretes');
    expect(tx.member.findMany).toHaveBeenCalledTimes(1);
  });

  it('sem negócio usa quem criou', async () => {
    const { service } = setup({
      reminder: { ...REMINDER, deal: null, lead: { fullName: 'Ana' } },
      managers: ['adm'],
      eligible: ['att', 'adm'],
    });
    await service.dispatch(JOB);
    expect(withItem.mock.calls[0][1].slice().sort()).toEqual(['adm', 'att']);
  });

  it('gerente com comercial-lembretes desligado não recebe; só o dono', async () => {
    const { service, fcm } = setup({
      reminder: REMINDER,
      managers: ['ger'],
      eligible: ['attB'],
      tokens: [
        { id: 't1', memberId: 'attB', token: 'tok-1', provider: 'fcm' },
        { id: 't3', memberId: 'ger', token: 'tok-3', provider: 'fcm' },
      ],
    });
    expect(await service.dispatch(JOB)).toMatchObject({ sent: 1 });
    expect(fcm.send).toHaveBeenCalledTimes(1);
  });

  it('dono Profissional que ganhou o item recebe', async () => {
    const { service, fcm } = setup({
      reminder: REMINDER,
      managers: [],
      eligible: ['attB'],
      tokens: [{ id: 't1', memberId: 'attB', token: 'tok-1', provider: 'fcm' }],
    });
    expect(await service.dispatch(JOB)).toMatchObject({ sent: 1 });
    expect(fcm.send).toHaveBeenCalledTimes(1);
  });

  it('lembrete concluído ou inexistente não envia', async () => {
    const { service, fcm } = setup({ reminder: null });
    expect(await service.dispatch(JOB)).toMatchObject({ sent: 0, skipped: 'no-reminder' });
    expect(fcm.send).not.toHaveBeenCalled();
  });

  it('sem canais habilitados fica skipped disabled', async () => {
    const { service, tx } = setup({ reminder: REMINDER, fcm: provider(false) });
    expect(await service.dispatch(JOB)).toMatchObject({ skipped: 'disabled' });
    expect(tx.commercialReminder.findFirst).not.toHaveBeenCalled();
  });
});
