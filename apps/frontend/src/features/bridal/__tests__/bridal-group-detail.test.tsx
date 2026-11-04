import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { BridalGroupQuery, SetBridalMemberCoverageMutation } from '../api/bridal.api';
import { BridalGroupDetailPage } from '../pages/BridalGroupDetailPage';
import { group, member } from './bridal-fixtures';

const g = group({
  id: 'g1',
  name: 'Casamento Ana',
  members: [
    member({ id: 'm1', role: 'bride', clientName: 'Ana Lima', coveredByContract: true }),
    member({ id: 'm2', clientName: 'Bia Madrinha', hasClosedComanda: true }),
    member({ id: 'm3', clientName: 'Carla Mãe' }),
  ],
});

const queryMock: MockedResponse = {
  request: { query: BridalGroupQuery },
  variableMatcher: () => true,
  maxUsageCount: 20,
  result: { data: { bridalGroup: g } },
};
const servicesMock: MockedResponse = {
  request: { query: ServicesQuery },
  variableMatcher: () => true,
  maxUsageCount: 20,
  result: { data: { services: [] } },
};

function renderPage(extra: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={[queryMock, servicesMock, ...extra]}>
      <MemoryRouter initialEntries={['/noivas/g1']}>
        <Routes>
          <Route path="/noivas/:id" element={<BridalGroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('BridalGroupDetailPage', () => {
  it('desabilita a cobertura quando a comanda já foi fechada', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderPage();
    expect(await screen.findByTestId('coverage-m2')).toBeDisabled();
    expect(screen.getByTestId('coverage-m3')).toBeEnabled();
  });

  it('mostra a mensagem clara quando o backend recusa a cobertura', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderPage([
      {
        request: { query: SetBridalMemberCoverageMutation },
        variableMatcher: () => true,
        result: {
          data: {
            setBridalMemberCoverage: {
              __typename: 'BridalGroupPayload',
              group: null,
              errors: [
                {
                  __typename: 'UserError',
                  code: 'COVERAGE_LOCKED',
                  message: 'raw',
                  field: null,
                },
              ],
            },
          },
        },
      },
    ]);
    fireEvent.click(await screen.findByTestId('coverage-m3'));
    expect(await screen.findByTestId('members-errors')).toHaveTextContent(
      'comanda fechada; a cobertura pelo contrato não pode mais ser alterada',
    );
  });

  it('"Criar contrato" aponta para /contratos?grupo=<id>', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderPage();
    const link = await screen.findByTestId('create-contract');
    expect(link).toHaveAttribute('href', '/contratos?grupo=g1');
  });

  it('atendente não vê "Criar contrato" nem "Cancelar grupo"', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    renderPage();
    await screen.findByTestId('coverage-m3');
    expect(screen.queryByTestId('create-contract')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-group')).not.toBeInTheDocument();
  });
});
