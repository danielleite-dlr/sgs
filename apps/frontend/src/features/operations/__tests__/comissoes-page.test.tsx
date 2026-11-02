import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { MembersQuery } from '@/features/catalog/api/members.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CommissionRecordsQuery, CommissionTotalsQuery } from '../api/financial.api';
import { ComissoesCalculadasPage } from '../pages/ComissoesCalculadasPage';

const totals = [
  { __typename: 'CommissionMemberTotal', memberId: 'a', memberName: 'Ana', total: '40.00', records: 2, noRuleCount: 0 },
  { __typename: 'CommissionMemberTotal', memberId: 'b', memberName: 'Bia', total: '5.00', records: 1, noRuleCount: 1 },
];

function renderPage(extra: MockedResponse[] = []) {
  const mocks: MockedResponse[] = [
    {
      request: { query: CommissionTotalsQuery },
      variableMatcher: () => true,
      result: { data: { commissionTotals: totals } },
      maxUsageCount: 5,
    },
    {
      request: { query: MembersQuery },
      result: { data: { members: [] } },
      maxUsageCount: 5,
    },
    {
      request: { query: CommissionRecordsQuery },
      variableMatcher: () => true,
      result: { data: { commissionRecords: [] } },
      maxUsageCount: 5,
    },
    ...extra,
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter>
        <ComissoesCalculadasPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('ComissoesCalculadasPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      permissions: ['commissionRecord.read', 'commission.write'],
      roleName: 'MANAGER',
    });
  });

  it('mostra totais, badge Sem regra e banner com link para as regras', async () => {
    renderPage();
    expect(await screen.findByText('Sem regra: 1')).toBeInTheDocument();
    expect(screen.getByTestId('commission-total-a')).toHaveTextContent('R$ 40,00');
    const link = screen.getByRole('link', { name: 'Revisar regras de comissão' });
    expect(link).toHaveAttribute('href', '/catalogo/comissoes');
    expect(screen.getByTestId('commission-member-select')).toBeInTheDocument();
  });

  it('PROFESSIONAL não vê o seletor de profissional nem o banner', async () => {
    useAuthStore.setState({ permissions: ['commissionRecord.read'], roleName: 'PROFESSIONAL' });
    renderPage();
    expect(await screen.findByText('Sem regra: 1')).toBeInTheDocument();
    expect(screen.queryByTestId('commission-member-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('commission-no-rule-banner')).not.toBeInTheDocument();
    expect(await screen.findByTestId('commission-records')).toBeInTheDocument();
  });
});
