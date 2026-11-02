import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PaymentPanel } from '../components/comanda/PaymentPanel';
import { makeComanda } from './comanda-fixtures';
import type { ComandaData } from '../api/comandas.api';

function renderPanel(comanda: ComandaData, extra: Partial<React.ComponentProps<typeof PaymentPanel>> = {}) {
  const onAddPayment = vi.fn().mockResolvedValue(undefined);
  render(
    <PaymentPanel
      comanda={comanda}
      canWrite
      canClose
      busy={false}
      onAddPayment={onAddPayment}
      onRemovePayment={vi.fn().mockResolvedValue(undefined)}
      onClose={vi.fn().mockResolvedValue(undefined)}
      {...extra}
    />,
  );
  return { onAddPayment };
}

describe('PaymentPanel', () => {
  it('mostra a falta e sugere usar o crédito do cliente', () => {
    const { onAddPayment } = renderPanel(makeComanda({ clientCreditBalance: '50.00' }));
    expect(screen.getByTestId('payment-remaining')).toHaveTextContent('R$ 135,00');
    const btn = screen.getByTestId('payment-use-credit');
    expect(btn).toHaveTextContent('Usar crédito do cliente (R$ 50,00)');
    fireEvent.click(btn);
    expect(onAddPayment).toHaveBeenCalledWith({ method: 'client_credit', amount: '50.00' });
  });

  it('preview de troco com dinheiro digitado e envia o pagamento', async () => {
    const { onAddPayment } = renderPanel(
      makeComanda({
        clientCreditBalance: '0.00',
        paid: '100.00',
        remaining: '35.00',
        payments: [
          { id: 'p1', method: 'client_credit', amount: '50.00', paidAt: '', memberId: null },
          { id: 'p2', method: 'pix', amount: '50.00', paidAt: '', memberId: null },
        ],
      }),
    );
    fireEvent.change(screen.getByTestId('payment-method-select'), { target: { value: 'cash' } });
    fireEvent.change(screen.getByTestId('payment-amount'), { target: { value: '5000' } });
    expect(screen.getByTestId('payment-amount')).toHaveValue('50,00');
    expect(screen.getByTestId('payment-change')).toHaveTextContent('R$ 15,00');
    expect(screen.getByTestId('payment-remaining')).toHaveTextContent('R$ 0,00');
    fireEvent.click(screen.getByTestId('payment-add'));
    await waitFor(() =>
      expect(onAddPayment).toHaveBeenCalledWith({ method: 'cash', amount: '50.00' }),
    );
  });

  it('troco sem dinheiro mostra o erro e mantém Fechar desabilitado', () => {
    renderPanel(
      makeComanda({
        total: '100.00',
        paid: '130.00',
        remaining: '0.00',
        change: '30.00',
        canClose: false,
        closeError: 'INVALID_CHANGE',
        payments: [{ id: 'p1', method: 'pix', amount: '130.00', paidAt: '', memberId: null }],
      }),
    );
    expect(screen.getByTestId('payment-error')).toHaveTextContent(
      'O troco só pode sair de pagamento em dinheiro.',
    );
    expect(screen.getByTestId('comanda-close')).toBeDisabled();
  });

  it('comanda fechada fica somente leitura', () => {
    renderPanel(
      makeComanda({
        status: 'closed',
        canClose: true,
        closeError: null,
        paid: '135.00',
        remaining: '0.00',
        payments: [{ id: 'p1', method: 'pix', amount: '135.00', paidAt: '', memberId: null }],
      }),
    );
    expect(screen.queryByTestId('payment-amount')).not.toBeInTheDocument();
    expect(screen.queryByTestId('payment-add')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comanda-close')).not.toBeInTheDocument();
    expect(screen.getByTestId('payment-row-p1')).toBeInTheDocument();
  });

  it('nunca oferece voucher e esconde crédito do cliente sem saldo', () => {
    renderPanel(makeComanda());
    const labels = Array.from(
      screen.getByTestId('payment-method-select').querySelectorAll('option'),
    ).map((o) => o.textContent);
    expect(labels).toEqual([
      'Dinheiro',
      'Pix',
      'Cartão de crédito',
      'Cartão de débito',
      'Transferência',
    ]);
  });

  it('Fechar habilita quando o backend permite e o usuário tem comanda.close', () => {
    renderPanel(
      makeComanda({
        canClose: true,
        closeError: null,
        paid: '135.00',
        remaining: '0.00',
        payments: [{ id: 'p1', method: 'pix', amount: '135.00', paidAt: '', memberId: null }],
      }),
    );
    expect(screen.getByTestId('comanda-close')).toBeEnabled();
  });
});
