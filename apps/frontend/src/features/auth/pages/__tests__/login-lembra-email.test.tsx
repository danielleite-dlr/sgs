import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';

const applyAuthPayload = vi.fn(() => true);
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ applyAuthPayload, logout: vi.fn() }),
}));

const loginFn = vi.fn();
vi.mock('../../api/auth.api', () => ({
  useLoginMutation: () => [loginFn, { loading: false }],
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
  return {
    email: document.querySelector<HTMLInputElement>('#email')!,
    senha: document.querySelector<HTMLInputElement>('#password')!,
    entrar: document.querySelector<HTMLButtonElement>('form button[type="submit"]')!,
  };
}

async function digitar(el: HTMLInputElement, valor: string) {
  await act(async () => {
    fireEvent.change(el, { target: { value: valor } });
  });
}

beforeEach(() => {
  localStorage.clear();
  loginFn.mockReset();
  applyAuthPayload.mockClear();
  vi.restoreAllMocks();
});

describe('login: lembra o último e-mail', () => {
  it('pré-preenche o e-mail salvo e foca a senha', async () => {
    localStorage.setItem('sgs-last-email', 'dona@salao.com');
    const { email, senha, entrar } = renderLogin();
    expect(email.value).toBe('dona@salao.com');
    expect(document.activeElement).toBe(senha);
    await digitar(senha, 'segredo123');
    expect(entrar).toBeEnabled();
  });

  it('sem e-mail salvo: campo vazio e focado', () => {
    const { email } = renderLogin();
    expect(email.value).toBe('');
    expect(document.activeElement).toBe(email);
  });

  it('grava o e-mail (com trim) após login bem-sucedido', async () => {
    loginFn.mockResolvedValue({ data: { login: { errors: [], session: null } } });
    const { email, senha } = renderLogin();
    await digitar(email, 'dona@salao.com');
    await digitar(senha, 'segredo123');
    await act(async () => {
      fireEvent.keyDown(senha, { key: 'Enter' });
    });
    expect(localStorage.getItem('sgs-last-email')).toBe('dona@salao.com');
  });

  it('não grava quando as credenciais são inválidas', async () => {
    loginFn.mockResolvedValue({
      data: { login: { errors: [{ code: 'INVALID_CREDENTIALS' }], session: null } },
    });
    const { email, senha } = renderLogin();
    await digitar(email, 'dona@salao.com');
    await digitar(senha, 'errada');
    await act(async () => {
      fireEvent.keyDown(senha, { key: 'Enter' });
    });
    expect(localStorage.getItem('sgs-last-email')).toBeNull();
  });

  it('localStorage lançando erro não quebra a tela', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('negado');
    });
    const orig = globalThis.localStorage;
    const broken = { ...orig, getItem: () => { throw new Error('negado'); } };
    vi.stubGlobal('localStorage', broken);
    const { email } = renderLogin();
    expect(email.value).toBe('');
    vi.unstubAllGlobals();
  });
});
