import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PeriodFilter } from '../components/PeriodFilter';
import { defaultPeriod } from '../lib/period-value';

describe('PeriodFilter', () => {
  it('padrão é Mês atual', () => {
    expect(defaultPeriod().preset).toBe('thisMonth');
  });

  it('clicar em Hoje emite o preset today', () => {
    const onChange = vi.fn();
    render(<PeriodFilter value={defaultPeriod()} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: 'today' }));
  });

  it('Personalizado com data inexistente mantém Aplicar desabilitado', () => {
    render(<PeriodFilter value={defaultPeriod()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId('period-preset-custom'));
    fireEvent.change(screen.getByTestId('period-custom-from'), { target: { value: '31022026' } });
    fireEvent.change(screen.getByTestId('period-custom-to'), { target: { value: '01032026' } });
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });

  it('datas válidas emitem to = dia seguinte (exclusivo)', () => {
    const onChange = vi.fn();
    render(<PeriodFilter value={defaultPeriod()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('period-preset-custom'));
    fireEvent.change(screen.getByTestId('period-custom-from'), { target: { value: '01032026' } });
    fireEvent.change(screen.getByTestId('period-custom-to'), { target: { value: '31032026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onChange).toHaveBeenCalledWith({ preset: 'custom', from: '2026-03-01', to: '2026-04-01' });
  });
});
