import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ applyAuthPayload: vi.fn(), logout: vi.fn() }),
}));

vi.mock('../../api/auth.api', () => ({
  useLoginMutation: () => [vi.fn(), { loading: false }],
}));

const nativo = vi.hoisted(() => ({ valor: false }));
vi.mock('@/infrastructure/native/platform', () => ({ isNativeApp: () => nativo.valor }));

import { LoginPage } from '../LoginPage';

// Quick 261117-2pd: botão "Baixar app Android" na login, só na web.

function renderLogin() {
  render(
    <MockedProvider mocks={[]}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('login: baixar app Android', () => {
  beforeEach(() => {
    nativo.valor = false;
  });

  it('na web mostra o link de download do APK, fora do formulário', () => {
    renderLogin();
    const link = screen.getByRole('link', { name: /baixar app android/i });
    expect(link).toHaveAttribute('href', '/download/gestor-beauty.apk');
    expect(link).toHaveAttribute('download', 'gestor-beauty.apk');
    expect(link.closest('form')).toBeNull();
  });

  it('dentro do app nativo o link não aparece', () => {
    nativo.valor = true;
    renderLogin();
    expect(screen.queryByRole('link', { name: /baixar app android/i })).toBeNull();
    expect(document.querySelector('a[href="/download/gestor-beauty.apk"]')).toBeNull();
  });
});
