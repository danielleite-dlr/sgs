import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@/infrastructure/i18n';

const h = vi.hoisted(() => ({ native: true }));
vi.mock('../platform', () => ({ isNativeApp: () => h.native }));

import { OfflineOverlay } from '../OfflineOverlay';

let online = true;
const reload = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  h.native = true;
  online = true;
  reload.mockClear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload },
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

describe('OfflineOverlay', () => {
  it('não renderiza no navegador comum, mesmo sem rede', () => {
    h.native = false;
    online = false;
    render(<OfflineOverlay />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('não renderiza no app quando há rede', () => {
    render(<OfflineOverlay />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('aparece ao cair a rede e some ao voltar, sem recarregar', () => {
    render(<OfflineOverlay />);
    act(() => {
      online = false;
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Sem conexão')).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível falar com o Gestor Beauty/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();

    act(() => {
      online = true;
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it('"Tentar novamente" recarrega o sistema', () => {
    online = false;
    render(<OfflineOverlay />);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('já aparece quando monta sem rede', () => {
    online = false;
    render(<OfflineOverlay />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
