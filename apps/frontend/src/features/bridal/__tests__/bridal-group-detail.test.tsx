import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function renderPage(extra: MockedResponse[] = [], main: MockedResponse = queryMock) {
  return render(
    <MockedProvider mocks={[main, servicesMock, ...extra]}>
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
    // o contêiner aria-live já existe vazio: esperar a resposta da mutation preencher
    await waitFor(() =>
      expect(screen.getByTestId('members-errors')).toHaveTextContent(
        'comanda fechada; a cobertura pelo contrato não pode mais ser alterada',
      ),
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

  it('mostra o pacote contratado (ou "—" sem pacote)', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    const { unmount } = renderPage([], {
      ...queryMock,
      result: { data: { bridalGroup: { ...g, packageId: 'p1', packageName: 'Pacote Ouro' } } },
    });
    const dd = await screen.findByTestId('bg-detail-package');
    expect(dd).toHaveTextContent('Pacote Ouro');
    expect(dd.previousElementSibling).toHaveTextContent('Pacote contratado');
    unmount();
    renderPage();
    expect(await screen.findByTestId('bg-detail-package')).toHaveTextContent('—');
  });
  describe('UX-14: status único, campo vazio escondido e telefone formatado', () => {
    function withGroup(over: Record<string, unknown>): MockedResponse {
      return { ...queryMock, result: { data: { bridalGroup: { ...g, ...over } } } };
    }

    it('mostra um só Badge de status e a legenda do contrato em rascunho', async () => {
      useAuthStore.setState({ roleName: 'MANAGER' });
      renderPage([], withGroup({ contractId: 'ct1', contractCode: 'CT-1', contractStatus: 'draft' }));
      const badges = await screen.findAllByTestId('group-status');
      expect(badges).toHaveLength(1);
      expect(badges[0]).toHaveTextContent('Ativo');
      const caption = screen.getByTestId('group-contract-status');
      expect(caption).toHaveTextContent('Contrato em rascunho');
      expect(caption.tagName).toBe('P');
      expect(screen.queryByText('Rascunho', { exact: true })).not.toBeInTheDocument();
    });

    it('sem contrato não mostra legenda de contrato', async () => {
      useAuthStore.setState({ roleName: 'MANAGER' });
      renderPage();
      expect(await screen.findAllByTestId('group-status')).toHaveLength(1);
      expect(screen.queryByTestId('group-contract-status')).not.toBeInTheDocument();
    });

    it('esconde "Pronta até" sem valor e mostra o horário quando existe', async () => {
      useAuthStore.setState({ roleName: 'MANAGER' });
      const { unmount } = renderPage();
      await screen.findByTestId('bg-detail-package');
      expect(screen.queryByText('Pronta até')).not.toBeInTheDocument();
      unmount();
      // 17:00 UTC = 14:00 em São Paulo, no dia do evento
      renderPage([], withGroup({ readyBy: '2026-12-05T17:00:00.000Z' }));
      const dd = await screen.findByTestId('bg-detail-ready-by');
      expect(dd).toHaveTextContent('14:00');
      expect(dd.previousElementSibling).toHaveTextContent('Pronta até');
    });

    it('formata o telefone da pessoa como (11) 98888-7777', async () => {
      useAuthStore.setState({ roleName: 'MANAGER' });
      renderPage(
        [],
        withGroup({
          members: [member({ id: 'm9', clientName: 'Duda Lima', clientPhone: '+5511988887777' })],
        }),
      );
      const row = await screen.findByTestId('member-m9');
      expect(row).toHaveTextContent('(11) 98888-7777');
      expect(row).not.toHaveTextContent('+5511988887777');
    });
  });
});
