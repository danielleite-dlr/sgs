import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateField } from '../date-field';

function Harness({ initial = '', spy }: { initial?: string; spy?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateField
      id="d"
      value={value}
      data-testid="d-input"
      onChange={(v) => {
        spy?.(v);
        setValue(v);
      }}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('DateField', () => {
  it('digitar aplica a máscara dd/mm/aaaa', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Harness spy={spy} />);
    await user.type(screen.getByTestId('d-input'), '27112026');
    expect(spy).toHaveBeenLastCalledWith('27/11/2026');
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it('botão abre o painel no mês do valor, com dia selecionado e semana a partir do domingo', async () => {
    const user = userEvent.setup();
    render(<Harness initial="06/11/2026" />);
    const btn = screen.getByRole('button', { name: 'Abrir calendário' });
    expect(btn).toHaveClass('h-11', 'w-11');
    expect(screen.queryByTestId('d-picker-panel')).toBeNull();
    await user.click(btn);
    expect(screen.getByTestId('d-picker-panel')).toBeInTheDocument();
    expect(screen.getByTestId('d-picker-title')).toHaveTextContent('Novembro de 2026');
    expect(screen.getByTestId('d-picker-day-2026-11-06')).toHaveAttribute('aria-pressed', 'true');
    const wd = within(screen.getByTestId('d-picker-weekdays'));
    expect(wd.getAllByText(/^[DSTQ]$/).map((e) => e.textContent)).toEqual([
      'D',
      'S',
      'T',
      'Q',
      'Q',
      'S',
      'S',
    ]);
  });

  it('clicar num dia preenche o campo e fecha o painel', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial="06/11/2026" spy={spy} />);
    await user.click(screen.getByTestId('d-picker'));
    await user.click(screen.getByTestId('d-picker-day-2026-11-20'));
    expect(spy).toHaveBeenLastCalledWith('20/11/2026');
    expect(screen.queryByTestId('d-picker-panel')).toBeNull();
    expect(screen.getByTestId('d-input')).toHaveValue('20/11/2026');
  });

  it('navega entre meses', async () => {
    const user = userEvent.setup();
    render(<Harness initial="06/11/2026" />);
    await user.click(screen.getByTestId('d-picker'));
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByTestId('d-picker-title')).toHaveTextContent('Dezembro de 2026');
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(screen.getByTestId('d-picker-title')).toHaveTextContent('Outubro de 2026');
  });

  it('valor incompleto abre no mês de hoje e marca o dia atual', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 27));
    const user = userEvent.setup();
    render(<Harness initial="12/1" />);
    await user.click(screen.getByTestId('d-picker'));
    expect(screen.getByTestId('d-picker-title')).toHaveTextContent('Novembro de 2026');
    expect(screen.getByTestId('d-picker-day-2026-11-27')).toHaveAttribute('aria-current', 'date');
  });
});
