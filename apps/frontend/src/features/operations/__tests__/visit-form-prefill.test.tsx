import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { ClientsListQuery } from '@/features/clients/api/clients.api';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { VisitFormDialog } from '../components/calendar/VisitFormDialog';

// quick 261124-mkp: "Agendar agora" do grupo da noiva abre o formulário com pessoa e serviço.

const mocks: MockedResponse[] = [
  {
    request: { query: ClientsListQuery },
    variableMatcher: () => true,
    maxUsageCount: 20,
    result: { data: { clients: { __typename: 'ClientsPage', totalCount: 0, rows: [] } } },
  },
  {
    request: { query: ServicesQuery },
    variableMatcher: () => true,
    maxUsageCount: 20,
    result: {
      data: {
        services: [
          {
            __typename: 'Service',
            id: 'make',
            name: 'Maquiagem madrinha',
            categoryId: 'cat',
            category: null,
            basePrice: '100.00',
            defaultDurationMinutes: 75,
            displayOrder: 0,
            coverImageUrl: null,
            pricingVariants: [],
          },
          {
            __typename: 'Service',
            id: 'pent',
            name: 'Penteado',
            categoryId: 'cat',
            category: null,
            basePrice: '100.00',
            defaultDurationMinutes: 60,
            displayOrder: 1,
            coverImageUrl: null,
            pricingVariants: [],
          },
        ],
      },
    },
  },
];

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('VisitFormDialog — preenchido pelo grupo da noiva', () => {
  it('abre com a cliente selecionada, o serviço e a duração padrão', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    render(
      <MockedProvider mocks={mocks}>
        <VisitFormDialog
          open
          onOpenChange={() => undefined}
          date={new Date(2026, 10, 20)}
          professionals={[]}
          onCreated={() => undefined}
          prefill={{ clientId: 'c-edi', clientName: 'Maria Edileide', serviceIds: ['make'] }}
        />
      </MockedProvider>,
    );
    expect(await screen.findByTestId('visit-client-selected')).toHaveTextContent('Maria Edileide');
    await waitFor(() => expect(screen.getByTestId('visit-line-0-duration')).toHaveValue('75'));
    expect(screen.getByTestId('visit-line-0-service')).toHaveValue('make');
  });

  function renderSequence(withTime: boolean) {
    useAuthStore.setState({ roleName: 'MANAGER' });
    render(
      <MockedProvider mocks={mocks}>
        <VisitFormDialog
          open
          onOpenChange={() => undefined}
          date={new Date(2026, 10, 20)}
          professionals={[]}
          onCreated={() => undefined}
          initialTime={withTime ? { hour: 10, minute: 0 } : undefined}
          prefill={{ clientId: 'c-edi', clientName: 'Maria Edileide', serviceIds: ['make', 'pent'] }}
        />
      </MockedProvider>,
    );
  }

  it('com hora inicial, os serviços entram em sequência e sem cascata depois', async () => {
    renderSequence(true);
    await waitFor(() => expect(screen.getByTestId('visit-line-1-time')).toHaveValue('11:15'));
    expect(screen.getByTestId('visit-line-0-time')).toHaveValue('10:00');
    fireEvent.change(screen.getByTestId('visit-line-0-time'), { target: { value: '10:30' } });
    expect(screen.getByTestId('visit-line-1-time')).toHaveValue('11:15');
  });

  it('não oferece a opção Pacote nas linhas', async () => {
    renderSequence(true);
    await waitFor(() => expect(screen.getByTestId('visit-line-0-duration')).toHaveValue('75'));
    expect(screen.queryByTestId('visit-line-0-kind-package')).toBeNull();
  });

  it('sem hora inicial, as horas continuam vazias', async () => {
    renderSequence(false);
    await waitFor(() => expect(screen.getByTestId('visit-line-1-duration')).toHaveValue('60'));
    expect(screen.getByTestId('visit-line-0-time')).toHaveValue('');
    expect(screen.getByTestId('visit-line-1-time')).toHaveValue('');
  });
});
