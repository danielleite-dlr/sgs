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
  bridalTrialIncluded: false,
  trialDate: null as string | null,
  reversesRecordId: null as string | null,
  contractId: null as string | null,
});
const anaRecords = [
  record('2', '2026-11-12', 'Carla', 'Penteado', '25.00'),
  record('1', '2026-11-10', 'Beatriz', 'Maquiagem', '15.00'),
];

/** Ewelly: teste incluso fechado duas vezes (estorno no meio) + dia da noiva. */
const bridalRecords = [
  {
    ...record('t1', '2026-11-17', 'Ewelly', 'Maquiagem noiva', '400.00'),
    reversed: true,
    bridalTrialIncluded: true,
    contractId: 'ct',
  },
  {
    ...record('t1r', '2026-11-17', 'Ewelly', 'Maquiagem noiva', '-400.00'),
    kind: 'reversal',
    reversesRecordId: 't1',
    bridalTrialIncluded: true,
    contractId: 'ct',
  },
  {
    ...record('t2', '2026-11-17', 'Ewelly', 'Maquiagem noiva', '0.00'),
    bridalTrialIncluded: true,
    contractId: 'ct',
  },
  {
    ...record('ev', '2026-11-20', 'Ewelly', 'Maquiagem noiva', '400.00'),
    contractId: 'ct',
    trialDate: '2026-11-17T13:00:00.000Z',
  },
];

function renderPage(
  extra: MockedResponse[] = [],
  recs: unknown[] = anaRecords,
  totalsData: unknown[] = totals,
) {
  const mocks: MockedResponse[] = [
    {
      request: { query: CommissionTotalsQuery },
      variableMatcher: () => true,
      result: { data: { commissionTotals: totalsData } },
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
      result: { data: { commissionRecords: recs } },
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

  it('relatório impresso não traz o valor cobrado, só a comissão', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver atendimentos de Ana' }));
    const report = await screen.findByTestId('commission-print-report');
    expect(report).not.toHaveTextContent('Valor cobrado');
    expect(within(report).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Data',
      'Cliente',
      'Serviço',
      'Comissão',
    ]);
    expect(report).toHaveTextContent('R$ 25,00');
    expect(report).not.toHaveTextContent('R$ 100,00');
  });

  it('admin/gerente vê Cobrado e Regra; PROFESSIONAL não', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver atendimentos de Ana' }));
    const table = await screen.findByTestId('commission-records');
    await within(table).findAllByText('Beatriz');
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toContain('Cobrado');
    expect(heads).toContain('Regra');
  });

  it('rodapé "Total a pagar" soma atendimentos e total ganho em centavos', async () => {
    renderPage([], anaRecords, [
      { ...totals[0], total: '120.10', records: 2 },
      { ...totals[1], total: '20.20', records: 1 },
    ]);
    const sum = await screen.findByTestId('commission-totals-sum');
    expect(sum).toHaveTextContent('Total a pagar');
    expect(sum).toHaveTextContent('3');
    expect(sum).toHaveTextContent('R$ 140,30');
  });

  it('rodapé de total não aparece para PROFESSIONAL', async () => {
    useAuthStore.setState({ permissions: ['commissionRecord.read'], roleName: 'PROFESSIONAL' });
    renderPage();
    await screen.findByTestId('commission-total-a');
    expect(screen.queryByTestId('commission-totals-sum')).not.toBeInTheDocument();
  });

  it('PROFESSIONAL não vê as colunas Cobrado e Regra nem o "cheio"', async () => {
    useAuthStore.setState({ permissions: ['commissionRecord.read'], roleName: 'PROFESSIONAL' });
    renderPage();
    const table = await screen.findByTestId('commission-records');
    await within(table).findAllByText('Beatriz');
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(['Data', 'Cliente', 'Serviço', 'Comissão', 'Comanda']);
    expect(table).not.toHaveTextContent('cheio');
    expect(table).not.toHaveTextContent('20,00%');
    expect(table).toHaveTextContent('R$ 15,00');
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

  it('teste de noiva incluso + dia da noiva = 1 linha; estornos só na auditoria', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderPage([], bridalRecords);
    fireEvent.click(await screen.findByTestId('commission-total-a'));
    const table = await screen.findByTestId('commission-records');
    await within(table).findAllByText('Ewelly');
    let rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('20/11/2026');
    expect(rows[0]).toHaveTextContent('Dia da noiva + teste em 17/11/2026 (1 atendimento)');
    expect(rows[0]).toHaveTextContent('R$ 400,00');

    fireEvent.click(screen.getByTestId('commission-whatsapp'));
    const text = decodeURIComponent(String(open.mock.calls[0][0]).split('text=')[1]);
    expect(text.match(/Ewelly/g)).toHaveLength(1);
    open.mockRestore();

    fireEvent.click(screen.getByTestId('commission-show-reversals'));
    rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
  });
});
