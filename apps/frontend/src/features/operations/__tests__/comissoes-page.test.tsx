import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import { MembersQuery } from '@/features/catalog/api/members.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { CommissionRecordsQuery, CommissionTotalsQuery } from '../api/financial.api';
import { ComissoesCalculadasPage } from '../pages/ComissoesCalculadasPage';

const totals = [
  { __typename: 'CommissionMemberTotal', memberId: 'a', memberName: 'Ana', memberPhone: '(11) 97777-6666', total: '40.00', records: 2, noRuleCount: 0 },
  { __typename: 'CommissionMemberTotal', memberId: 'b', memberName: 'Bia', memberPhone: null, total: '5.00', records: 1, noRuleCount: 1 },
];

const record = (id: string, day: string, client: string, item: string, amount: string) => ({
  __typename: 'CommissionRecordEntry',
  id,
  comandaId: `c-${id}`,
  comandaCode: `CMD-${id}`,
  comandaItemId: `i-${id}`,
  memberId: 'a',
  memberName: 'Ana',
  kind: 'accrual',
  cycle: 1,
  itemName: item,
  baseAmount: '100.00',
  chargedAmount: '100.00',
  ruleKind: 'percentage',
  ruleValue: '20.00',
  noRule: false,
  calculatedAmount: amount,
  reversed: false,
  calculatedAt: `${day}T18:00:00.000Z`,
  clientName: client,
  serviceDate: `${day}T13:00:00.000Z`,
});
const anaRecords = [
  record('2', '2026-11-12', 'Carla', 'Penteado', '25.00'),
  record('1', '2026-11-10', 'Beatriz', 'Maquiagem', '15.00'),
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
      result: { data: { commissionRecords: anaRecords } },
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

  it('clicar na profissional mostra atendimentos com data, cliente e serviço', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver atendimentos de Ana' }));
    const table = await screen.findByTestId('commission-records');
    const rows = within(table).getAllByRole('row').slice(1);
    // ordem de atendimento: 10/11 antes de 12/11
    expect(rows[0]).toHaveTextContent('10/11/2026');
    expect(rows[0]).toHaveTextContent('Beatriz');
    expect(rows[0]).toHaveTextContent('Maquiagem');
    expect(rows[1]).toHaveTextContent('Carla');
    expect(screen.getByText('Atendimentos de Ana')).toBeInTheDocument();
    expect(screen.getByTestId('commission-total-a')).toHaveAttribute('data-state', 'selected');
    expect(screen.getByTestId('commission-print-report')).toHaveTextContent('Relatório de comissões');
  });

  it('Enviar por WhatsApp abre wa.me com o telefone e o resumo', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderPage();
    fireEvent.click(await screen.findByTestId('commission-total-a'));
    const btn = await screen.findByTestId('commission-whatsapp');
    await screen.findAllByText('Beatriz');
    fireEvent.click(btn);
    const url = String(open.mock.calls[0][0]);
    expect(url.startsWith('https://wa.me/5511977776666?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('Profissional: Ana');
    expect(text).toContain('Beatriz · Maquiagem · R$ 15,00');
    expect(text).toContain('*Total: R$ 40,00*');
    open.mockRestore();
  });

  it('Gerar relatório imprime só o relatório e restaura a página', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.body.classList.contains('printing-commission-report')).toBe(true);
      expect(document.title).toContain('Comissões - Ana');
    });
    renderPage();
    fireEvent.click(await screen.findByTestId('commission-total-a'));
    await screen.findAllByText('Beatriz');
    fireEvent.click(screen.getByTestId('commission-print'));
    expect(print).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('printing-commission-report')).toBe(false);
    print.mockRestore();
  });
});
