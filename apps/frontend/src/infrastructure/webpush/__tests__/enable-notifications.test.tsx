import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@/infrastructure/i18n';

const m = vi.hoisted(() => ({
  contexto: true,
  ios: true,
  chave: 'chave' as string | null,
  estado: 'default' as string,
  enable: vi.fn(),
  fetchKey: vi.fn(),
}));

vi.mock('../platform-ios', () => ({
  isWebPushContext: () => m.contexto,
  isIosDevice: () => m.ios,
}));
vi.mock('../web-push-client', () => ({
  getWebPushState: vi.fn(async () => m.estado),
  enableWebPush: (...a: unknown[]) => m.enable(...a),
}));
vi.mock('../push-config.api', () => ({
  fetchWebPushPublicKey: () => m.fetchKey(),
}));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { EnableNotificationsBanner } from '../EnableNotificationsBanner';

const KEY = 'sgs-webpush-aviso-adiado';

async function montar() {
  render(<EnableNotificationsBanner />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('faixa Ativar notificações', () => {
  beforeEach(() => {
    m.contexto = true;
    m.ios = true;
    m.chave = 'chave';
    m.estado = 'default';
    m.enable = vi.fn().mockResolvedValue('granted');
    m.fetchKey = vi.fn(async () => m.chave);
    window.localStorage.clear();
    useAuthStore.setState({ impersonating: false });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('fora do contexto Web Push não renderiza nem consulta o servidor', async () => {
    m.contexto = false;
    await montar();
    expect(screen.queryByText('Ativar notificações')).toBeNull();
    expect(m.fetchKey).not.toHaveBeenCalled();
  });

  it('fora de iOS e impersonando não renderiza', async () => {
    m.ios = false;
    await montar();
    expect(m.fetchKey).not.toHaveBeenCalled();
    cleanup();
    m.ios = true;
    useAuthStore.setState({ impersonating: true });
    await montar();
    expect(m.fetchKey).not.toHaveBeenCalled();
  });

  it('canal desligado (chave nula) não renderiza', async () => {
    m.chave = null;
    await montar();
    expect(screen.queryByRole('button', { name: 'Ativar notificações' })).toBeNull();
  });

  it('estado granted ao montar não renderiza', async () => {
    m.estado = 'granted';
    await montar();
    expect(screen.queryByRole('button', { name: 'Ativar notificações' })).toBeNull();
  });

  it('mostra a faixa em default e needs-subscribe', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Ativar notificações' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeInTheDocument();
    cleanup();
    m.estado = 'needs-subscribe';
    await montar();
    expect(screen.getByRole('button', { name: 'Ativar notificações' })).toBeInTheDocument();
  });

  it('clicar ativa direto no gesto, mostra Ativando… e depois o sucesso', async () => {
    let resolve!: (v: string) => void;
    m.enable = vi.fn(() => new Promise((r) => (resolve = r)));
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ativar notificações' }));
    expect(m.enable).toHaveBeenCalledWith('chave');
    expect(screen.getByRole('button', { name: 'Ativando…' })).toBeDisabled();
    await act(async () => resolve('granted'));
    expect(screen.getByText('Notificações ativadas neste iPhone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  });

  it('negado na hora vira o estado bloqueado', async () => {
    m.enable = vi.fn().mockResolvedValue('denied');
    await montar();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ativar notificações' }));
    });
    expect(screen.getByText('Notificações bloqueadas')).toBeInTheDocument();
  });

  it('erro mostra a mensagem e o botão volta', async () => {
    m.enable = vi.fn().mockResolvedValue('error');
    await montar();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ativar notificações' }));
    });
    expect(screen.getByText('Não foi possível ativar agora. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ativar notificações' })).toBeEnabled();
  });

  it('denied mostra o caminho nos Ajustes', async () => {
    m.estado = 'denied';
    await montar();
    expect(screen.getByText(/Ajustes → Notificações → Gestor Beauty/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  });

  it('unsupported pede para atualizar o iOS', async () => {
    m.estado = 'unsupported';
    await montar();
    expect(screen.getByText(/iOS 16\.4/)).toBeInTheDocument();
  });

  it('Agora não adia por 7 dias e depois volta a aparecer', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(screen.queryByRole('button', { name: 'Ativar notificações' })).toBeNull();
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    cleanup();

    m.fetchKey.mockClear();
    await montar();
    expect(m.fetchKey).not.toHaveBeenCalled();
    cleanup();

    window.localStorage.setItem(KEY, String(Date.now() - 8 * 24 * 3600 * 1000));
    await montar();
    expect(screen.getByRole('button', { name: 'Ativar notificações' })).toBeInTheDocument();
  });
});
