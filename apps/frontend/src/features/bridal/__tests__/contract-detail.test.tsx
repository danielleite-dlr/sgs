import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  CancelContractMutation,
  ContractCancellationPreviewQuery,
  ContractQuery,
  ContractReadinessQuery,
  GenerateContractLinkMutation,
  RecordContractPaymentMutation,
  type ContractData,
} from '../api/contracts.api';
import { ContractDetailPage } from '../pages/ContractDetailPage';
import { makeContract, makePackageContract, withTypenames } from './contract-fixtures';

const PAYMENTS = [
  {
    id: 'p1',
    kind: 'payment',
    method: 'pix',
    amount: '1500.00',
    paidAt: '2030-01-05T12:00:00.000Z',
    memberId: null,
    reversesPaymentId: null,
    reversed: false,
    note: null,
  },
  {
    id: 'p2',
    kind: 'payment',
    method: 'cash',
    amount: '500.00',
    paidAt: '2030-01-10T12:00:00.000Z',
    memberId: null,
    reversesPaymentId: null,
    reversed: false,
    note: null,
  },
];

const CONTRACT = makeContract({
  payments: PAYMENTS,
  balanceDueSoon: true,
  daysToBalanceDue: 2,
  acceptance: null,
});

const readinessMock = (
  missing: Array<{ code: string; label: string; target: string; targetId: string | null }> = [],
): MockedResponse => ({
  request: { query: ContractReadinessQuery, variables: { id: 'ct1' } },
  result: {
    data: {
      contractReadiness: {
        __typename: 'ContractReadiness',
        ready: missing.length === 0,
        missing: missing.map((m) => ({ __typename: 'ContractMissingField', ...m })),
      },
    },
  },
});

function renderPage(
  contract: ContractData,
  extra: MockedResponse[] = [],
  readiness: MockedResponse = readinessMock(),
) {
  const mocks: MockedResponse[] = [
    readiness,
    {
      request: { query: ContractQuery, variables: { id: 'ct1' } },
      result: { data: { contract: withTypenames(contract) } },
    },
    ...extra,
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/contratos/ct1']}>
        <Routes>
          <Route path="/contratos/:id" element={<ContractDetailPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('ContractDetailPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ roleName: 'MANAGER', permissions: [] });
  });

  it('mostra pago, saldo e o badge Vence em 2 dias', async () => {
    renderPage(CONTRACT);
    expect(await screen.findByTestId('contract-paid')).toHaveTextContent('R$ 2.000,00');
    expect(screen.getByTestId('contract-balance')).toHaveTextContent('R$ 6.000,00');
    expect(screen.getByText('Vence em 2 dias')).toBeInTheDocument();
    expect(screen.getByTestId('contract-text')).toHaveTextContent('TEXTO DO CONTRATO');
  });

  it('Gerar link mostra a URL e Copiar link chama clipboard.writeText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPage(CONTRACT, [
      {
        request: { query: GenerateContractLinkMutation, variables: { id: 'ct1' } },
        result: {
          data: {
            generateContractLink: {
              __typename: 'ContractLinkPayload',
              url: 'https://app.test/aceite/org/tok',
              expiresAt: '2030-02-01T00:00:00.000Z',
              contract: withTypenames(CONTRACT),
              errors: [],
            },
          },
        },
      },
    ]);
    fireEvent.click(await screen.findByTestId('contract-generate-link'));
    expect(await screen.findByTestId('contract-link-url')).toHaveValue(
      'https://app.test/aceite/org/tok',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://app.test/aceite/org/tok'));
  });

  it('diálogo de pagamento envia 2 linhas', async () => {
    const spy = vi.fn();
    renderPage(CONTRACT, [
      {
        request: { query: RecordContractPaymentMutation },
        variableMatcher: (vars: Record<string, unknown>) => {
          spy(vars);
          return true;
        },
        result: {
          data: {
            recordContractPayment: {
              __typename: 'ContractPayload',
              contract: withTypenames(CONTRACT),
              errors: [],
            },
          },
        },
      },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pagamento' }));
    fireEvent.change(await screen.findByLabelText('Valor 1'), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar forma de pagamento' }));
    fireEvent.change(screen.getByLabelText('Forma 2'), { target: { value: 'cash' } });
    fireEvent.change(screen.getByLabelText('Valor 2'), { target: { value: '50000' } });
    expect(screen.getByTestId('cp-balance-after')).toHaveTextContent('R$ 4.500,00');
    fireEvent.click(screen.getByTestId('cp-submit'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const input = (spy.mock.calls[0][0] as { input: { lines: unknown[]; contractId: string } }).input;
    expect(input.contractId).toBe('ct1');
    expect(input.lines).toEqual([
      { method: 'pix', amount: '1000.00' },
      { method: 'cash', amount: '500.00' },
    ]);
  });

  it('cancelamento pelo estúdio mostra a prévia de devolução e exige o método', async () => {
    const cancelSpy = vi.fn();
    renderPage(CONTRACT, [
      {
        request: {
          query: ContractCancellationPreviewQuery,
          variables: { contractId: 'ct1', party: 'studio' },
        },
        result: {
          data: {
            contractCancellationPreview: {
              __typename: 'ContractCancellationPreview',
              paid: '2000.00',
              retained: '0.00',
              refund: '2000.00',
              party: 'studio',
            },
          },
        },
      },
      {
        request: { query: CancelContractMutation },
        variableMatcher: (vars: Record<string, unknown>) => {
          cancelSpy(vars);
          return true;
        },
        result: {
          data: {
            cancelContract: {
              __typename: 'ContractPayload',
              contract: withTypenames({ ...CONTRACT, status: 'cancelled' }),
              errors: [],
            },
          },
        },
      },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar contrato' }));
    fireEvent.click(await screen.findByLabelText('Pelo estúdio'));
    expect(await screen.findByTestId('cancel-preview')).toHaveTextContent(
      'Pago R$ 2.000,00 · Retido R$ 0,00 · Devolver R$ 2.000,00',
    );
    fireEvent.change(screen.getByLabelText('Motivo do cancelamento'), {
      target: { value: 'Estúdio fechou a data' },
    });
    const submit = screen.getByTestId('cancel-submit');
    expect(submit).toBeDisabled(); // falta o método da devolução
    fireEvent.change(screen.getByLabelText('Método da devolução'), { target: { value: 'pix' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(cancelSpy).toHaveBeenCalled());
    expect((cancelSpy.mock.calls[0][0] as { input: Record<string, unknown> }).input).toMatchObject({
      contractId: 'ct1',
      party: 'studio',
      refundMethod: 'pix',
    });
  });

  it('ATTENDANT registra pagamento, mas não vê Cancelar contrato nem Estornar', async () => {
    useAuthStore.setState({ roleName: 'ATTENDANT', permissions: [] });
    renderPage(CONTRACT);
    expect(await screen.findByRole('button', { name: 'Registrar pagamento' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar contrato' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Estornar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    const table = screen.getByTestId('contract-payments');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('MANAGER vê o botão Estornar nos pagamentos', async () => {
    renderPage(CONTRACT);
    await screen.findByTestId('contract-payments');
    expect(screen.getAllByRole('button', { name: /Estornar pagamento/ })).toHaveLength(2);
  });

  it('mostra as parcelas com Paga e Vencida', async () => {
    renderPage(makePackageContract());
    const card = await screen.findByTestId('contract-installments');
    expect(within(card).getByText('Sinal parcelado', { exact: false })).toBeInTheDocument();
    expect(within(card).getByText('Paga')).toBeInTheDocument();
    expect(within(card).getByText('Vencida')).toBeInTheDocument();
    expect(within(card).getByText('SINAL 1/2')).toBeInTheDocument();
    expect(within(card).getByText(/até 7 dias antes do evento \(08\/06\/2030\)/)).toBeInTheDocument();
  });

  it('com pendências, Gerar link fica desabilitado e lista os atalhos', async () => {
    renderPage(
      CONTRACT,
      [],
      readinessMock([
        { code: 'CLIENT_CPF', label: 'CPF da contratante', target: 'client', targetId: 'c1' },
        { code: 'STUDIO_CNPJ', label: 'CNPJ do estúdio', target: 'settings', targetId: null },
      ]),
    );
    const box = await screen.findByTestId('contract-missing');
    expect(within(box).getByText('CPF da contratante')).toBeInTheDocument();
    expect(within(box).getByText('CNPJ do estúdio')).toBeInTheDocument();
    expect(within(box).getByRole('link', { name: 'Editar cliente' })).toHaveAttribute(
      'href',
      '/clientes/c1/editar',
    );
    expect(within(box).getByRole('link', { name: 'Abrir configurações' })).toHaveAttribute(
      'href',
      '/contratos?aba=configuracoes',
    );
    expect(screen.getByTestId('contract-generate-link')).toBeDisabled();
  });

  it('sem pendências, Gerar link fica habilitado', async () => {
    renderPage(CONTRACT);
    const btn = await screen.findByTestId('contract-generate-link');
    await waitFor(() => expect(btn).toBeEnabled());
    expect(screen.queryByTestId('contract-missing')).not.toBeInTheDocument();
  });

  it('rascunho oferece Baixar PDF (não aceito)', async () => {
    renderPage(makePackageContract());
    expect(await screen.findByRole('button', { name: 'Baixar PDF (não aceito)' })).toBeInTheDocument();
  });

  it('debutante mostra "Debutante:"', async () => {
    renderPage(makeContract({ eventKind: 'debutante', contractorName: 'Mãe da Bia' }));
    expect(await screen.findByText('Debutante:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Mãe da Bia')).toBeInTheDocument();
  });
});
