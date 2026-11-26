import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { AddItemDialog } from '../components/comanda/AddItemDialog';
import { ProfessionalsForServiceQuery } from '../api/appointments.api';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { makeComanda } from './comanda-fixtures';

const servicesMock = {
  request: { query: ServicesQuery },
  result: {
    data: {
      services: [
        {
          id: 's1',
          name: 'Corte',
          categoryId: 'cat-1',
          category: { id: 'cat-1', name: 'Cabelo', parentId: null },
          basePrice: '80.00',
          defaultDurationMinutes: 60,
          displayOrder: 1,
          coverImageUrl: null,
          pricingVariants: [],
        },
      ],
    },
  },
};

// Ordem alfabética vinda do servidor, com a fixa no fim: o seletor deve subi-la.
const prosMock = {
  request: { query: ProfessionalsForServiceQuery, variables: { serviceId: 's1' } },
  result: {
    data: {
      professionalsForService: [
        { id: 'p1', displayName: 'Ana', isFixed: false },
        { id: 'p2', displayName: 'Bia', isFixed: false },
        { id: 'p3', displayName: 'Zélia', isFixed: true },
      ],
    },
  },
};

describe('AddItemDialog — ordem dos profissionais', () => {
  it('mostra a profissional fixa primeiro', async () => {
    render(
      <MockedProvider mocks={[servicesMock, prosMock]} addTypename={false}>
        <AddItemDialog
          mode="service"
          comanda={makeComanda()}
          open
          onOpenChange={() => {}}
          onDone={() => {}}
        />
      </MockedProvider>,
    );
    await waitFor(() => expect(screen.getByText(/Corte —/)).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('add-item-service'), { target: { value: 's1' } });
    await waitFor(() => expect(screen.getByText('Zélia')).toBeInTheDocument());
    const options = screen
      .getAllByRole('option')
      .map((o) => o.textContent)
      .filter((t) => ['Ana', 'Bia', 'Zélia'].includes(t ?? ''));
    expect(options).toEqual(['Zélia', 'Ana', 'Bia']);
  });
});
