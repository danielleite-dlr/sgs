import {
  buildPushMessage,
  eventPhrase,
  PushAppointmentView,
  PushBridalGroupView,
} from './push-messages';

const TZ = 'America/Sao_Paulo';
const group: PushBridalGroupView = {
  id: 'g1',
  name: 'Noiva Vitória',
  eventKind: 'noiva',
  eventDate: new Date('2026-11-08T00:00:00Z'),
  brideName: 'Vitória Almeida',
};

function appt(i: number, over: Partial<PushAppointmentView> = {}): PushAppointmentView {
  return {
    id: `a${i}`,
    professionalId: 'proA',
    professionalName: 'Ana',
    clientName: 'Vitória Almeida',
    serviceName: 'Maquiagem',
    startsAt: new Date(Date.UTC(2026, 10, 5, 12 + i)),
    bridalGroup: group,
    ...over,
  };
}
const own = (n: number) => ({
  memberId: 'proA',
  scope: 'own' as const,
  appointmentIds: Array.from({ length: n }, (_, i) => `a${i + 1}`),
});
const all = { memberId: 'adm', scope: 'all' as const, appointmentIds: [] };

describe('eventPhrase', () => {
  it('noiva', () => expect(eventPhrase(group)).toBe('no casamento da Vitória'));
  it('debutante', () =>
    expect(eventPhrase({ ...group, eventKind: 'debutante', brideName: 'Ana Luíza Prado' })).toBe(
      'nos 15 anos da Ana',
    ));
  it('sem nome da noiva', () =>
    expect(eventPhrase({ ...group, brideName: null })).toBe('no evento Noiva Vitória'));
});

describe('avisos de lote (D-15)', () => {
  it('3 atendimentos da profissional viram um aviso', () => {
    const m = buildPushMessage('bridal.scheduled', own(3), [appt(1), appt(2), appt(3)], TZ);
    expect(m.title).toBe('Novo agendamento de noiva');
    expect(m.body).toBe('3 atendimentos no casamento da Vitória, 08/11');
  });

  it('1 atendimento no singular', () => {
    const m = buildPushMessage('bridal.scheduled', own(1), [appt(1)], TZ);
    expect(m.body).toBe('1 atendimento no casamento da Vitória, 08/11');
  });

  it('gestora com 2 profissionais', () => {
    const list = [
      appt(1),
      appt(2),
      appt(3, { professionalId: 'proB', professionalName: 'Bia' }),
      appt(4, { professionalId: 'proB', professionalName: 'Bia' }),
      appt(5),
    ];
    const m = buildPushMessage('bridal.scheduled', all, list, TZ);
    expect(m.body).toBe('5 atendimentos no casamento da Vitória, 08/11 (2 profissionais)');
  });

  it('gestora com 1 profissional', () => {
    const m = buildPushMessage('bridal.scheduled', all, [appt(1), appt(2)], TZ);
    expect(m.body).toBe('2 atendimentos no casamento da Vitória, 08/11 (com Ana)');
  });

  it('debutante muda o título', () => {
    const g = { ...group, eventKind: 'debutante' };
    const m = buildPushMessage('bridal.scheduled', own(1), [appt(1, { bridalGroup: g })], TZ);
    expect(m.title).toBe('Novo agendamento de debutante');
  });

  it('cancelamento em massa', () => {
    const m = buildPushMessage('bridal.cancelled', own(2), [appt(1), appt(2)], TZ);
    expect(m).toMatchObject({
      title: 'Agendamentos cancelados',
      body: '2 atendimentos cancelados no casamento da Vitória, 08/11',
    });
  });

  it('cancelamento de 1', () => {
    const m = buildPushMessage('bridal.cancelled', own(1), [appt(1)], TZ);
    expect(m).toMatchObject({
      title: 'Agendamento cancelado',
      body: '1 atendimento cancelado no casamento da Vitória, 08/11',
    });
  });

  it('data inclui groupId e a rota do primeiro por startsAt', () => {
    const m = buildPushMessage('bridal.scheduled', own(2), [appt(2), appt(1)], TZ);
    expect(m.data.groupId).toBe('g1');
    expect(m.data.appointmentId).toBe('a1');
    expect(m.data.route).toBe('/agenda?data=2026-11-05&visao=day&agendamento=a1');
  });

  it('sem bridalGroup cai no formato de appointment.created', () => {
    const m = buildPushMessage('bridal.scheduled', own(1), [appt(1, { bridalGroup: null })], TZ);
    expect(m.title).toBe('Novo agendamento');
    expect(m.body).toBe('Vitória Almeida · Maquiagem, 05/11 às 10:00');
  });
});
