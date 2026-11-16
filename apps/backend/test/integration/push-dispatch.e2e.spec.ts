import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PushService } from '../../src/push/push.service';
import type { PushMessage, PushProvider, PushSendResult } from '../../src/push/push.types';

const CREATE = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code } }
}`;

describe('Fase 7 - dispatch do push (Postgres real, RLS real, provider falso)', () => {
  let w: Phase3World;
  let service: PushService;
  let appointmentId: string;
  const sent: { token: string; message: PushMessage }[] = [];

  const fake: PushProvider = {
    enabled: true,
    send: jest.fn(async (token: string, message: PushMessage): Promise<PushSendResult> => {
      sent.push({ token, message });
      return token === 'tok-p7-dead'
        ? { status: 'invalid_token', reason: 'UNREGISTERED' }
        : { status: 'sent' };
    }),
  };

  const countNotifications = () =>
    adminPrisma.notification.count({ where: { organizationId: w.orgId } });

  beforeAll(async () => {
    w = await createPhase3World('p7push');
    service = new PushService(w.app.get(TenantContextService), fake);

    const mk = (memberId: string, token: string) =>
      adminPrisma.deviceToken.create({
        data: { organizationId: w.orgId, memberId, platform: 'android', token },
      });
    await mk(w.members.proA, 'tok-p7-proa');
    await mk(w.members.manager, 'tok-p7-ger');
    await mk(w.members.admin, 'tok-p7-dead');

    const r = await gqlAs(w, w.tokens.attendant)(CREATE, {
      i: {
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: '2030-05-03T13:00:00Z',
        endsAt: '2030-05-03T14:00:00Z',
      },
    });
    expect(r.data.createAppointment.errors).toEqual([]);
    appointmentId = r.data.createAppointment.appointment.id;
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM device_tokens WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await destroyPhase3World(w);
  });

  beforeEach(() => {
    sent.length = 0;
  });

  it('envia para profissional e gestoras, apaga token inválido e não cria notificações', async () => {
    const before = await countNotifications();
    const r = await service.dispatch({
      kind: 'appointment.created',
      orgId: w.orgId,
      actorMemberId: w.members.attendant,
      appointmentIds: [appointmentId],
    });

    expect(sent.map((s) => s.token).sort()).toEqual(['tok-p7-dead', 'tok-p7-ger', 'tok-p7-proa']);
    expect(r).toMatchObject({ sent: 2, invalid: 1, failed: 0 });
    expect(sent.find((s) => s.token === 'tok-p7-proa')!.message.body).not.toContain('(com ');
    expect(sent.find((s) => s.token === 'tok-p7-ger')!.message.body).toContain('(com ');

    const left = await adminPrisma.deviceToken.findMany({ where: { organizationId: w.orgId } });
    expect(left.map((t) => t.token).sort()).toEqual(['tok-p7-ger', 'tok-p7-proa']);
    expect(await countNotifications()).toBe(before);
  });

  it('o autor da ação não recebe', async () => {
    await service.dispatch({
      kind: 'appointment.created',
      orgId: w.orgId,
      actorMemberId: w.members.manager,
      appointmentIds: [appointmentId],
    });
    expect(sent.map((s) => s.token)).not.toContain('tok-p7-ger');
    expect(sent.map((s) => s.token)).toContain('tok-p7-proa');
  });
});
