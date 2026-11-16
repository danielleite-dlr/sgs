import { buildPushMessage, PushAppointmentView } from './push-messages';

const TZ = 'America/Sao_Paulo';

function appt(over: Partial<PushAppointmentView> = {}): PushAppointmentView {
  return {
    id: 'a1',
    professionalId: 'proA',
    professionalName: 'Ana',
    clientName: 'Maria Souza',
    serviceName: 'Escova',
    startsAt: new Date('2026-11-20T17:00:00Z'),
    bridalGroup: null,
    ...over,
  };
}
const own = { memberId: 'proA', scope: 'own' as const, appointmentIds: ['a1'] };
const all = { memberId: 'adm', scope: 'all' as const, appointmentIds: ['a1'] };

describe('buildPushMessage', () => {
  it('created, own', () => {
    const m = buildPushMessage('appointment.created', own, [appt()], TZ);
    expect(m.title).toBe('Novo agendamento');
    expect(m.body).toBe('Maria Souza · Escova, 20/11 às 14:00');
  });

  it('created, all acrescenta a profissional', () => {
    const m = buildPushMessage('appointment.created', all, [appt()], TZ);
    expect(m.body).toBe('Maria Souza · Escova, 20/11 às 14:00 (com Ana)');
  });

  it('created, own, 2 serviços da mesma cliente', () => {
    const m = buildPushMessage(
      'appointment.created',
      own,
      [appt({ id: 'a2', startsAt: new Date('2026-11-20T18:00:00Z') }), appt()],
      TZ,
    );
    expect(m.body).toBe('Maria Souza · 2 serviços, 20/11 a partir de 14:00');
  });

  it('cancelled, own', () => {
    const m = buildPushMessage('appointment.cancelled', own, [appt()], TZ);
    expect(m.title).toBe('Agendamento cancelado');
    expect(m.body).toBe('Maria Souza · Escova, 20/11 às 14:00');
  });

  it('data tem kind, route e appointmentId, tudo string', () => {
    const m = buildPushMessage('appointment.created', own, [appt()], TZ);
    expect(m.data).toEqual({
      kind: 'appointment.created',
      route: '/agenda?data=2026-11-20&visao=day&agendamento=a1',
      appointmentId: 'a1',
    });
  });

  it('usa o fuso do salão, nunca UTC', () => {
    const m = buildPushMessage(
      'appointment.created',
      own,
      [appt({ startsAt: new Date('2026-11-21T02:30:00Z') })],
      TZ,
    );
    expect(m.data.route).toBe('/agenda?data=2026-11-20&visao=day&agendamento=a1');
    expect(m.body).toBe('Maria Souza · Escova, 20/11 às 23:30');
  });
});
