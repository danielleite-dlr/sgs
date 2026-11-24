import { unscheduledEventServices } from './bridal-serialize';

// quick 261124-n98: cada agendamento ativo cobre um serviço planejado da mesma pessoa.
describe('unscheduledEventServices', () => {
  const m = (id: string, services: [string, string][]) => ({
    id,
    clientId: `c-${id}`,
    services: services.map(([serviceId, purpose]) => ({ serviceId, purpose })),
  });

  it('aponta o serviço do evento sem agendamento e ignora o teste', () => {
    const out = unscheduledEventServices(
      [m('edna', [['make', 'event'], ['pent', 'event'], ['make', 'trial']])],
      [{ clientId: 'c-edna', serviceId: 'pent', purpose: 'event' }],
    );
    expect(out.get('edna')).toEqual(['make']);
  });

  it('purpose nulo conta como evento; agendamento de teste não cobre o evento', () => {
    const out = unscheduledEventServices(
      [m('a', [['make', 'event']]), m('b', [['make', 'event']])],
      [
        { clientId: 'c-a', serviceId: 'make', purpose: null },
        { clientId: 'c-b', serviceId: 'make', purpose: 'trial' },
      ],
    );
    expect(out.get('a')).toEqual([]);
    expect(out.get('b')).toEqual(['make']);
  });

  it('agendamento de outra pessoa não cobre', () => {
    const out = unscheduledEventServices(
      [m('a', [['make', 'event']])],
      [{ clientId: 'c-x', serviceId: 'make', purpose: 'event' }],
    );
    expect(out.get('a')).toEqual(['make']);
  });
});
