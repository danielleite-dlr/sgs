import { adminPrisma } from './setup';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';

const STATUS = `mutation($i: UpdateAppointmentStatusInput!) {
  updateAppointmentStatus(input: $i) { appointment { id status } errors { code message field } }
}`;
const CANCEL = `mutation($i: CancelAppointmentInput!) {
  cancelAppointment(input: $i) { appointment { id status cancelReason cancelReasonTag cancelledAt } errors { code message field } }
}`;
const CREATE = `mutation($i: CreateAppointmentInput!) {
  createAppointment(input: $i) { appointment { id } errors { code } }
}`;
const MOVE = `mutation($i: MoveAppointmentInput!) {
  moveAppointment(input: $i) { appointment { id } errors { code } }
}`;

describe('Phase 3 - ciclo de vida do agendamento', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p3life');
  });
  afterAll(async () => {
    await destroyPhase3World(w);
  });
  afterEach(async () => {
    await adminPrisma.$executeRawUnsafe(
      `UPDATE appointments SET comanda_id = NULL WHERE organization_id = '${w.orgId}'::uuid`,
    );
    for (const t of ['comanda_payments', 'comanda_items', 'comandas', 'appointments']) {
      await adminPrisma.$executeRawUnsafe(
        `DELETE FROM ${t} WHERE organization_id = '${w.orgId}'::uuid`,
      );
    }
  });

  const seed = (day: string, status = 'scheduled') =>
    adminPrisma.appointment.create({
      data: {
        organizationId: w.orgId,
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: new Date(`2030-05-${day}T10:00:00Z`),
        endsAt: new Date(`2030-05-${day}T11:00:00Z`),
        status,
      },
    });
  const status = async (id: string, s: string, token = w.tokens.attendant) =>
    (await gqlAs(w, token)(STATUS, { i: { id, status: s } })).data.updateAppointmentStatus;
  const cancel = async (id: string, reason: string, reasonTag?: string, token = w.tokens.attendant) =>
    (await gqlAs(w, token)(CANCEL, { i: { id, reason, reasonTag } })).data.cancelAppointment;

  it('scheduled -> confirmed ok; in_progress -> confirmed recusado', async () => {
    const a = await seed('01');
    expect((await status(a.id, 'confirmed')).appointment.status).toBe('confirmed');
    expect((await status(a.id, 'in_progress')).appointment.status).toBe('in_progress');
    expect((await status(a.id, 'confirmed')).errors[0].code).toBe('INVALID_STATUS_TRANSITION');
    expect((await status(a.id, 'completed')).errors[0].code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('cancelar exige motivo, inclusive para ADMIN', async () => {
    const a = await seed('02');
    for (const token of [w.tokens.attendant, w.tokens.admin]) {
      for (const reason of ['', '  ']) {
        expect((await cancel(a.id, reason, undefined, token)).errors[0].code).toBe('REASON_REQUIRED');
      }
    }
    const row = await adminPrisma.appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.status).toBe('scheduled');
  });

  it('cancelar com motivo e tag grava metadados e libera o horário', async () => {
    const a = await seed('03');
    const r = await cancel(a.id, 'Cliente avisou', 'cliente_desmarcou');
    expect(r.errors).toEqual([]);
    expect(r.appointment).toMatchObject({
      status: 'cancelled',
      cancelReason: 'Cliente avisou',
      cancelReasonTag: 'cliente_desmarcou',
    });
    expect(r.appointment.cancelledAt).toBeTruthy();
    const row = await adminPrisma.appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.cancelledBy).toBe(w.members.attendant);

    const again = await gqlAs(w, w.tokens.attendant)(CREATE, {
      i: {
        professionalId: w.members.proA,
        clientId: w.clientId,
        serviceId: w.serviceId,
        startsAt: '2030-05-03T10:00:00Z',
        endsAt: '2030-05-03T11:00:00Z',
      },
    });
    expect(again.data.createAppointment.errors).toEqual([]);
  });

  it('tag no_show vira status no_show', async () => {
    const a = await seed('04');
    const r = await cancel(a.id, 'Não compareceu', 'no_show', w.tokens.admin);
    expect(r.appointment.status).toBe('no_show');
  });

  it('tag inválida e cancelamento duplo são recusados', async () => {
    const a = await seed('05');
    expect((await cancel(a.id, 'motivo ok', 'xpto')).errors[0].code).toBe('INVALID_REASON_TAG');
    expect((await cancel(a.id, 'motivo ok')).errors).toEqual([]);
    expect((await cancel(a.id, 'motivo ok')).errors[0].code).toBe('INVALID_STATUS');
  });

  describe('com comanda', () => {
    const mkComanda = async (status: string, appointmentId: string, payments = false) => {
      const c = await adminPrisma.comanda.create({
        data: {
          organizationId: w.orgId,
          code: `T-${Math.random().toString(36).slice(2, 8)}`,
          clientId: w.clientId,
          status,
          total: '100.00',
          ...(status === 'closed' ? { closedAt: new Date() } : {}),
        },
      });
      await adminPrisma.comandaItem.create({
        data: {
          organizationId: w.orgId,
          comandaId: c.id,
          kind: 'service',
          serviceId: w.serviceId,
          appointmentId,
          professionalId: w.members.proA,
          nameSnapshot: 'x',
          quantity: 1,
          listUnitPrice: '100.00',
          unitPrice: '100.00',
          total: '100.00',
        },
      });
      if (payments) {
        await adminPrisma.comandaPayment.create({
          data: { organizationId: w.orgId, comandaId: c.id, method: 'cash', amount: '10.00' },
        });
      }
      await adminPrisma.appointment.update({ where: { id: appointmentId }, data: { comandaId: c.id } });
      return c;
    };

    it('comanda fechada bloqueia o cancelamento', async () => {
      const a = await seed('06');
      await mkComanda('closed', a.id);
      expect((await cancel(a.id, 'motivo ok')).errors[0].code).toBe('COMANDA_CLOSED');
    });

    it('comanda com pagamentos e sem outro agendamento bloqueia', async () => {
      const a = await seed('07');
      await mkComanda('open', a.id, true);
      expect((await cancel(a.id, 'motivo ok')).errors[0].code).toBe('COMANDA_HAS_PAYMENTS');
    });

    it('comanda aberta sem pagamentos é cancelada junto com os itens', async () => {
      const a = await seed('08');
      const c = await mkComanda('open', a.id);
      expect((await cancel(a.id, 'motivo ok')).errors).toEqual([]);
      const after = await adminPrisma.comanda.findUniqueOrThrow({ where: { id: c.id } });
      expect(after.status).toBe('cancelled');
      expect(after.cancelReason).toBe('motivo ok');
      expect(await adminPrisma.comandaItem.count({ where: { comandaId: c.id } })).toBe(0);
    });

    it('mover para outro profissional repassa os itens da comanda aberta', async () => {
      const a = await seed('09');
      const c = await mkComanda('open', a.id);
      const r = await gqlAs(w, w.tokens.attendant)(MOVE, {
        i: { id: a.id, professionalId: w.members.proB, startsAt: '2030-05-09T10:00:00Z' },
      });
      expect(r.data.moveAppointment.errors).toEqual([]);
      const item = await adminPrisma.comandaItem.findFirstOrThrow({ where: { comandaId: c.id } });
      expect(item.professionalId).toBe(w.members.proB);
    });
  });

  it('PROFESSIONAL não consegue mover nem cancelar', async () => {
    const a = await seed('10');
    const mv = await gqlAs(w, w.tokens.proA)(MOVE, {
      i: { id: a.id, professionalId: w.members.proA, startsAt: '2030-05-10T14:00:00Z' },
    });
    expect(mv.errors?.length).toBeGreaterThan(0);
    expect(JSON.stringify(mv.errors)).toMatch(/FORBIDDEN/);
    const cn = await gqlAs(w, w.tokens.proA)(CANCEL, { i: { id: a.id, reason: 'motivo ok' } });
    expect(JSON.stringify(cn.errors)).toMatch(/FORBIDDEN/);
    const st = await gqlAs(w, w.tokens.proA)(STATUS, { i: { id: a.id, status: 'confirmed' } });
    expect(JSON.stringify(st.errors)).toMatch(/FORBIDDEN/);
  });
});
