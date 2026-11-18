import { adminPrisma } from './setup';
import {
  createPhase9World,
  destroyPhase9World,
  insertDealRow,
  insertLeadRow,
  type Phase9World,
} from './helpers/phase9-fixtures';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { PushService } from '../../src/push/push.service';
import type { PushMessage, PushProvider, PushSendResult } from '../../src/push/push.types';

describe('fase 9 - push do lembrete comercial (Postgres real, RLS real, provider falso)', () => {
  let w: Phase9World;
  let service: PushService;
  let dealId: string;
  const sent: { token: string; message: PushMessage }[] = [];

  const fake: PushProvider = {
    enabled: true,
    send: jest.fn(async (token: string, message: PushMessage): Promise<PushSendResult> => {
      sent.push({ token, message });
      return { status: 'sent' };
    }),
  };

  const tokens = () => sent.map((s) => s.token).sort();
  const mkReminder = (data: {
    dealId?: string;
    leadId?: string;
    createdBy?: string;
    completedAt?: Date;
  }) =>
    adminPrisma.commercialReminder.create({
      data: { organizationId: w.orgId, title: 'Ligar para Ana', dueAt: new Date(), ...data },
    });
  const dispatch = (reminderId: string) =>
    service.dispatch({ kind: 'commercial.reminder', orgId: w.orgId, reminderId });

  beforeAll(async () => {
    w = await createPhase9World('p9push');
    service = new PushService(w.app.get(TenantContextService), fake);
    const mk = (memberId: string, token: string) =>
      adminPrisma.deviceToken.create({
        data: { organizationId: w.orgId, memberId, platform: 'android', token },
      });
    await mk(w.attendantB.memberId, 'tok-attb');
    await mk(w.members.attendant, 'tok-att');
    await mk(w.members.admin, 'tok-adm');
    await mk(w.members.manager, 'tok-ger');
    await mk(w.members.proA, 'tok-proa');
    const leadId = await insertLeadRow(w, { fullName: 'Ana Souza' });
    dealId = await insertDealRow(w, {
      leadId,
      assignee: w.attendantB.memberId,
      eventDate: '2027-05-10',
    });
  }, 120_000);

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM device_tokens WHERE organization_id = '${w.orgId}'::uuid`,
    );
    await destroyPhase9World(w);
  }, 120_000);

  beforeEach(() => {
    sent.length = 0;
  });

  it('negócio: responsável + admin + gerente, nunca atendente alheia nem profissional', async () => {
    const rem = await mkReminder({ dealId, createdBy: w.members.attendant });
    const r = await dispatch(rem.id);
    expect(tokens()).toEqual(['tok-adm', 'tok-attb', 'tok-ger']);
    expect(r).toMatchObject({ sent: 3, failed: 0 });
    expect(sent[0].message.data.route).toBe(`/comercial/lembretes?lembrete=${rem.id}`);
    expect(sent[0].message.body).toBe('Ana Souza · Noiva · 10/05/2027');
  });

  it('sem negócio: quem criou + admin + gerente', async () => {
    const rem = await mkReminder({ createdBy: w.members.attendant });
    await dispatch(rem.id);
    expect(tokens()).toEqual(['tok-adm', 'tok-att', 'tok-ger']);
  });

  it('lembrete concluído ou inexistente não envia', async () => {
    const rem = await mkReminder({ dealId, completedAt: new Date() });
    expect((await dispatch(rem.id)).skipped).toBe('no-reminder');
    expect((await dispatch('00000000-0000-4000-8000-000000000000')).skipped).toBe('no-reminder');
    expect(sent).toHaveLength(0);
  });

  it('responsável inativo não recebe; gerentes recebem', async () => {
    const rem = await mkReminder({ dealId });
    await adminPrisma.member.update({
      where: { id: w.attendantB.memberId },
      data: { status: 'inactive' },
    });
    try {
      await dispatch(rem.id);
      expect(tokens()).toEqual(['tok-adm', 'tok-ger']);
    } finally {
      await adminPrisma.member.update({
        where: { id: w.attendantB.memberId },
        data: { status: 'active' },
      });
    }
  });

  it('responsável que virou PROFESSIONAL não recebe', async () => {
    const rem = await mkReminder({ dealId });
    const pro = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'PROFESSIONAL', isSystem: true },
    });
    const att = await adminPrisma.role.findFirstOrThrow({
      where: { name: 'ATTENDANT', isSystem: true },
    });
    await adminPrisma.member.update({
      where: { id: w.attendantB.memberId },
      data: { roleId: pro.id },
    });
    try {
      await dispatch(rem.id);
      expect(tokens()).toEqual(['tok-adm', 'tok-ger']);
    } finally {
      await adminPrisma.member.update({
        where: { id: w.attendantB.memberId },
        data: { roleId: att.id },
      });
    }
  });
});
