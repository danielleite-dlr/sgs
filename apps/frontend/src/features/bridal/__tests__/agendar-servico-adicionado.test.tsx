import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { BridalGroupQuery, SetBridalMemberServicesMutation } from '../api/bridal.api';
import { BridalGroupDetailPage } from '../pages/BridalGroupDetailPage';
import { agendaNewVisitHref, newEventServiceIds } from '../lib/schedule-added';
import { group, member } from './bridal-fixtures';

// quick 261124-mkp: incluir serviço do evento numa pessoa do grupo pergunta se já agenda.

const svc = (id: string, name: string) => ({
  __typename: 'Service',
  id,
  name,
  categoryId: 'cat',
  category: null,
  basePrice: '100.00',
  defaultDurationMinutes: 60,
  displayOrder: 0,
  coverImageUrl: null,
  pricingVariants: [],
});

const g = group({
  id: 'g1',
  eventDate: '2026-11-20',
  members: [
    member({ id: 'm1', role: 'bride', clientName: 'Ana Lima' }),
    member({
      id: 'm2',
      clientId: 'c-edi',
      clientName: 'Maria Edileide',
      services: [
        {
          __typename: 'BridalMemberService',
          id: 'bms1',
          serviceId: 'pent',
          serviceName: 'Penteado madrinha',
          purpose: 'event',
          durationMinutes: 60,
        } as never,
      ],
    }),
  ],
});

const mocks: MockedResponse[] = [
  {
    request: { query: BridalGroupQuery },
    variableMatcher: () => true,
    maxUsageCount: 20,
    result: { data: { bridalGroup: g } },
  },
  {
    request: { query: ServicesQuery },
    variableMatcher: () => true,
    maxUsageCount: 20,
    result: { data: { services: [svc('pent', 'Penteado madrinha'), svc('make', 'Maquiagem madrinha')] } },
  },
  {
    request: { query: SetBridalMemberServicesMutation },
    variableMatcher: () => true,
    result: {
      data: {
        setBridalMemberServices: { __typename: 'BridalGroupPayload', group: null, errors: [] },
      },
    },
  },
];

function AgendaProbe() {
  const loc = useLocation();
  return <p data-testid="agenda-url">{loc.search}</p>;
}

function renderPage() {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/noivas/g1']}>
        <Routes>
          <Route path="/noivas/:id" element={<BridalGroupDetailPage />} />
          <Route path="/agenda" element={<AgendaProbe />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('helpers', () => {
  it('newEventServiceIds devolve só os serviços do evento acrescentados', () => {
    const before = [
      { serviceId: 'pent', purpose: 'event' },
      { serviceId: 'make', purpose: 'trial' },
    ];
    expect(
      newEventServiceIds(before, [...before, { serviceId: 'make', purpose: 'event' }]),
    ).toEqual(['make']);
    expect(newEventServiceIds(before, [{ serviceId: 'pent', purpose: 'event' }])).toEqual([]);
    expect(
      newEventServiceIds(before, [...before, { serviceId: 'pent', purpose: 'event' }]),
    ).toEqual(['pent']);
  });

  it('agendaNewVisitHref leva dia, pessoa e serviços', () => {
    const href = agendaNewVisitHref('2026-11-20T00:00:00.000Z', 'c1', 'Maria Edileide', ['a', 'b']);
    const p = new URLSearchParams(href.split('?')[1]);
    expect(href.startsWith('/agenda?')).toBe(true);
    expect(p.get('data')).toBe('2026-11-20');
    expect(p.get('novo')).toBe('1');
    expect(p.get('cliente')).toBe('c1');
    expect(p.get('nome')).toBe('Maria Edileide');
    expect(p.get('servicos')).toBe('a,b');
  });
});

describe('Agendar agora depois de incluir serviço', () => {
  async function addMake() {
    fireEvent.click(
      await screen.findByRole('button', { name: 'Editar serviços de Maria Edileide' }),
    );
    const select = await screen.findByLabelText('Adicionar serviço');
    await screen.findByRole('option', { name: 'Maquiagem madrinha' });
    fireEvent.change(select, { target: { value: 'make' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  }

  it('pergunta e abre a agenda do dia com a pessoa e o serviço', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderPage();
    await addMake();
    expect(await screen.findByTestId('schedule-added-dialog')).toHaveTextContent(
      'Maquiagem madrinha de Maria Edileide',
    );
    fireEvent.click(screen.getByTestId('schedule-added-go'));
    const p = new URLSearchParams((await screen.findByTestId('agenda-url')).textContent ?? '');
    expect(p.get('cliente')).toBe('c-edi');
    expect(p.get('servicos')).toBe('make');
    expect(p.get('data')).toBe('2026-11-20');
  });
});
