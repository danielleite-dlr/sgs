import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ applyAuthPayload: vi.fn(), logout: vi.fn() }),
}));

vi.mock('../../api/auth.api', () => ({
  useLoginMutation: () => [vi.fn(), { loading: false }],
}));

const estado = vi.hoisted(() => ({
  nativo: false,
  ios: false,
  standalone: false,
  safari: true,
}));
vi.mock('@/infrastructure/native/platform', () => ({ isNativeApp: () => estado.nativo }));
vi.mock('@/infrastructure/webpush/platform-ios', () => ({
  isIosDevice: () => estado.ios,
  isStandalone: () => estado.standalone,
  isIosSafari: () => estado.safari,
}));

import { LoginPage } from '../LoginPage';

function renderLogin() {
  render(
    <MockedProvider mocks={[]}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

const botao = () => screen.queryByRole('button', { name: 'Instalar no iPhone' });
const apk = () => screen.queryByRole('link', { name: /baixar app android/i });

describe('login: instalar no iPhone', () => {
  beforeEach(() => {
    estado.nativo = false;
    estado.ios = false;
    estado.standalone = false;
    estado.safari = true;
  });

  it('no iPhone mostra o botão fora do formulário e esconde o link do APK', () => {
    estado.ios = true;
    renderLogin();
    expect(botao()).not.toBeNull();
    expect(botao()!.closest('form')).toBeNull();
    expect(apk()).toBeNull();
  });

  it('no desktop mostra só o link do APK', () => {
    renderLogin();
    expect(botao()).toBeNull();
    expect(apk()).not.toBeNull();
  });

  it('no iPhone com o app instalado não mostra nenhum dos dois', () => {
    estado.ios = true;
    estado.standalone = true;
    renderLogin();
    expect(botao()).toBeNull();
    expect(apk()).toBeNull();
  });

  it('no app nativo não mostra nenhum dos dois', () => {
    estado.nativo = true;
    estado.ios = true;
    renderLogin();
    expect(botao()).toBeNull();
    expect(apk()).toBeNull();
  });

  it('o botão abre o passo a passo', () => {
    estado.ios = true;
    renderLogin();
    fireEvent.click(botao()!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument();
    expect(screen.getByText(/entre de novo/)).toBeInTheDocument();
    expect(screen.queryByText('Abra no Safari')).toBeNull();
  });

  it('fora do Safari avisa e copia o endereço', async () => {
    estado.ios = true;
    estado.safari = false;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderLogin();
    fireEvent.click(botao()!);
    expect(screen.getByText('Abra no Safari')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar endereço' }));
    expect(writeText).toHaveBeenCalledWith(window.location.origin + '/login');
    expect(await screen.findByRole('button', { name: 'Endereço copiado' })).toBeInTheDocument();
  });
});
