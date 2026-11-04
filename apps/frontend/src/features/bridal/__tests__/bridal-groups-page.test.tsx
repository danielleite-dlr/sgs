import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { BridalGroupsQuery, CreateBridalGroupMutation } from '../api/bridal.api';
import { BridalGroupsPage } from '../pages/BridalGroupsPage';
import { group, member } from './bridal-fixtures';

const g1 = group({
  id: 'g1',
  name: 'Casamento Ana',
  contractId: 'k1',
  contractCode: 'CT-001',
  contractStatus: 'active',
  members: [member({ id: 'm1', role: 'bride', clientName: 'Ana Lima' }), member({ id: 'm2' })],
});
const g2 = group({ id: 'g2', name: 'Casamento Bia', eventDate: '2026-12-12' });

const listMock: MockedResponse = {
  request: { query: BridalGroupsQuery },
  variableMatcher: () => true,
  maxUsageCount: 20,
  result: { data: { bridalGroups: [g1, g2] } },
};
const servicesMock: MockedResponse = {
  request: { query: ServicesQuery },
  variableMatcher: () => true,
  maxUsageCount: 50,
  result: { data: { services: [] } },
};

function renderPage(extra: MockedResponse[] = []) {
  return render(
    <MockedProvider mocks={[listMock, servicesMock, ...extra]}>
      <MemoryRouter initialEntries={['/noivas']}>
        <Routes>
          <Route path="/noivas" element={<BridalGroupsPage />} />
          <Route path="/noivas/:id" element={<div data-testid="detail-route" />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

describe('BridalGroupsPage', () => {
  it('lista os grupos com o badge do contrato', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    renderPage();
    expect(await screen.findByText('Casamento Ana')).toBeInTheDocument();
    expect(screen.getByText('Casamento Bia')).toBeInTheDocument();
    expect(screen.getByText('CT-001 — Ativo')).toBeInTheDocument();
    expect(screen.getByText('Sem contrato')).toBeInTheDocument();
    expect(screen.getByText('05/12/2026')).toBeInTheDocument();
  });

  it('ATTENDANT vê "Novo grupo"; PROFESSIONAL não', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT' });
    const { unmount } = renderPage();
    await screen.findByText('Casamento Ana');
    expect(screen.getByText('Novo grupo')).toBeInTheDocument();
    unmount();
    useAuthStore.setState({ roleName: 'PROFESSIONAL' });
    renderPage();
    await screen.findByText('Casamento Ana');
    expect(screen.queryByText('Novo grupo')).not.toBeInTheDocument();
  });

  it('cria grupo com noiva e 4 acompanhantes novas fora do contrato', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    let sent: { input: { companions: { coveredByContract: boolean }[]; bride: { coveredByContract: boolean } } } | null =
      null;
    renderPage([
      {
        request: { query: CreateBridalGroupMutation },
        variableMatcher: (v) => {
          sent = v as typeof sent;
          return true;
        },
        result: {
          data: { createBridalGroup: { __typename: 'BridalGroupPayload', group: g1, errors: [] } },
        },
      },
    ]);
    await screen.findByText('Casamento Ana');
    fireEvent.click(screen.getByTestId('new-group'));
    fireEvent.change(await screen.findByTestId('bg-name'), { target: { value: 'Casamento Carol' } });
    fireEvent.change(screen.getByTestId('bg-date'), { target: { value: '2026-12-20' } });
    fireEvent.change(screen.getByTestId('bride-name'), { target: { value: 'Carol Souza' } });
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByTestId('bg-add-companion'));
      fireEvent.change(await screen.findByTestId(`companion-${i}-name`), {
        target: { value: `Madrinha ${i + 1}` },
      });
    }
    fireEvent.click(screen.getByTestId('bg-submit'));
    expect(await screen.findByTestId('detail-route')).toBeInTheDocument();
    expect(sent).not.toBeNull();
    const input = sent!.input;
    expect(input.companions).toHaveLength(4);
    expect(input.companions.every((c) => c.coveredByContract === false)).toBe(true);
    expect(input.bride.coveredByContract).toBe(true);
  });

  it('valida o nome da noiva antes de enviar', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderPage();
    await screen.findByText('Casamento Ana');
    fireEvent.click(screen.getByTestId('new-group'));
    fireEvent.change(await screen.findByTestId('bg-name'), { target: { value: 'Grupo' } });
    fireEvent.change(screen.getByTestId('bg-date'), { target: { value: '2026-12-20' } });
    fireEvent.click(screen.getByTestId('bg-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('bg-errors')).toHaveTextContent('Noiva: informe o nome.'),
    );
  });
});
