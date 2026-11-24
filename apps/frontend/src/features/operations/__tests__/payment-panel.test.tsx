import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PaymentPanel } from '../components/comanda/PaymentPanel';
import { defaultCloseDate } from '../lib/close-date';
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

  it('destaca o crédito disponível e mostra quanto falta depois dele', () => {
    renderPanel(makeComanda({ clientCreditBalance: '50.00' }));
    const callout = screen.getByTestId('payment-credit-callout');
    expect(callout).toHaveTextContent('Crédito disponível: R$ 50,00');
    expect(screen.getByTestId('payment-after-credit')).toHaveTextContent(
      'Depois do crédito, falta R$ 85,00',
    );
  });

  it('com o crédito lançado, o destaque mostra o valor aplicado', () => {
    renderPanel(
      makeComanda({
        clientCreditBalance: '50.00',
        paid: '50.00',
        remaining: '85.00',
        payments: [
          { id: 'p1', method: 'client_credit', amount: '50.00', paidAt: '', memberId: null },
        ],
      }),
    );
    expect(screen.getByTestId('payment-credit-callout')).toHaveTextContent(
      'Crédito aplicado: R$ 50,00',
    );
    expect(screen.queryByTestId('payment-use-credit')).toBeNull();
  });

  it('sem crédito não mostra o destaque', () => {
    renderPanel(makeComanda({ clientCreditBalance: '0.00' }));
    expect(screen.queryByTestId('payment-credit-callout')).toBeNull();
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

  describe('data do fechamento (261124-k9b)', () => {
    const paid = {
      canClose: true,
      closeError: null,
      paid: '135.00',
      remaining: '0.00',
      payments: [{ id: 'p1', method: 'pix', amount: '135.00', paidAt: '', memberId: null }],
    };
    const local = (y: number, m: number, d: number, h = 13) => new Date(y, m - 1, d, h);

    it('padrão é o dia do atendimento e vai no fechamento', async () => {
      const onClose = vi.fn().mockResolvedValue(undefined);
      renderPanel(makeComanda({ ...paid, serviceAt: local(2026, 11, 20).toISOString() }), {
        onClose,
      });
      expect(screen.getByTestId('comanda-close-date')).toHaveValue('2026-11-20');
      expect(screen.getByTestId('comanda-close-date-hint')).toHaveTextContent(
        'Caixa e comissão entram em 20/11/2026.',
      );
      fireEvent.click(screen.getByTestId('comanda-close'));
      await waitFor(() => expect(onClose).toHaveBeenCalledWith('2026-11-20'));
    });

    it('pessoa troca a data manualmente', async () => {
      const onClose = vi.fn().mockResolvedValue(undefined);
      renderPanel(makeComanda({ ...paid, serviceAt: local(2026, 11, 20).toISOString() }), {
        onClose,
      });
      fireEvent.change(screen.getByTestId('comanda-close-date'), {
        target: { value: '2026-11-21' },
      });
      fireEvent.click(screen.getByTestId('comanda-close'));
      await waitFor(() => expect(onClose).toHaveBeenCalledWith('2026-11-21'));
    });

    it('data futura bloqueia o fechamento', () => {
      renderPanel(makeComanda(paid));
      fireEvent.change(screen.getByTestId('comanda-close-date'), {
        target: { value: '2999-01-01' },
      });
      expect(screen.getByTestId('comanda-close')).toBeDisabled();
      expect(screen.getByTestId('comanda-close-date-hint')).toHaveTextContent(
        'Escolha uma data de hoje ou anterior.',
      );
    });

    it('sem atendimento, ou atendimento futuro, o padrão é hoje', () => {
      const now = local(2026, 11, 24);
      expect(defaultCloseDate(null, now)).toBe('2026-11-24');
      expect(defaultCloseDate(local(2026, 11, 30).toISOString(), now)).toBe('2026-11-24');
      expect(defaultCloseDate(local(2026, 11, 20, 23).toISOString(), now)).toBe('2026-11-20');
    });
  });
});

