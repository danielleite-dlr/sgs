import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ applyAuthPayload: vi.fn(), logout: vi.fn() }),
}));

const loginFn = vi.fn(async () => ({ data: { login: { errors: [], session: null } } }));
vi.mock('../../api/auth.api', () => ({
  useLoginMutation: () => [loginFn, { loading: false }],
}));

import { LoginPage } from '../LoginPage';

// Quick 261107-kpj: o Entrar habilita enquanto a pessoa digita, sem precisar clicar fora.

function renderLogin() {
  render(
    <MockedProvider mocks={[]}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </MockedProvider>,
  );
  const email = document.querySelector<HTMLInputElement>('#email')!;
  const senha = document.querySelector<HTMLInputElement>('#password')!;
  const entrar = document.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
  return { email, senha, entrar };
}

async function digitar(el: HTMLInputElement, valor: string) {
  await act(async () => {
    fireEvent.change(el, { target: { value: valor } });
  });
}

describe('login: botão Entrar', () => {
  it('habilita com e-mail válido e senha digitados, sem sair do campo', async () => {
    const { email, senha, entrar } = renderLogin();
    expect(entrar).toBeDisabled();

    await digitar(email, 'dona@salao.com');
    expect(entrar).toBeDisabled();

    await digitar(senha, 'segredo123');
    expect(entrar).toBeEnabled();
    expect(document.activeElement === entrar).toBe(false);
  });

  it('desabilita de novo se apagar a senha ou o e-mail ficar inválido', async () => {
    const { email, senha, entrar } = renderLogin();
    await digitar(email, 'dona@salao.com');
    await digitar(senha, 'segredo123');
    expect(entrar).toBeEnabled();

    await digitar(senha, '');
    expect(entrar).toBeDisabled();

    await digitar(senha, 'segredo123');
    await digitar(email, 'dona@');
    expect(entrar).toBeDisabled();
  });

  it('não acusa e-mail inválido enquanto digita; acusa ao sair do campo', async () => {
    const { email } = renderLogin();
    await digitar(email, 'dona@');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(email).not.toHaveAttribute('aria-invalid', 'true');

    await act(async () => {
      fireEvent.blur(email);
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
  });
});

// Quick 261108: Enter envia e o autopreenchimento do navegador não depende de clique na página.
describe('login: Enter e autopreenchimento', () => {
  beforeEach(() => loginFn.mockClear());

  it('Enter no campo de senha envia o formulário', async () => {
    const { email, senha } = renderLogin();
    await digitar(email, 'dona@salao.com');
    await digitar(senha, 'segredo123');
    await act(async () => {
      fireEvent.keyDown(senha, { key: 'Enter' });
    });
    expect(loginFn).toHaveBeenCalledTimes(1);
    expect(loginFn).toHaveBeenCalledWith({
      variables: { input: { email: 'dona@salao.com', password: 'segredo123' } },
    });
  });

  it('Enter envia valores preenchidos pelo navegador sem evento de digitação', async () => {
    const { email, senha } = renderLogin();
    // Autopreenchimento: o valor aparece no DOM sem o React Hook Form receber change.
    email.value = 'dona@salao.com';
    senha.value = 'segredo123';
    await act(async () => {
      fireEvent.keyDown(senha, { key: 'Enter' });
    });
    expect(loginFn).toHaveBeenCalledWith({
      variables: { input: { email: 'dona@salao.com', password: 'segredo123' } },
    });
  });

  it('habilita o Entrar sozinho quando o navegador preenche os campos', async () => {
    vi.useFakeTimers();
    try {
      const { email, senha, entrar } = renderLogin();
      expect(entrar).toBeDisabled();
      email.value = 'dona@salao.com';
      senha.value = 'segredo123';
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(entrar).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Enter com e-mail inválido não envia e mostra o erro', async () => {
    const { email, senha } = renderLogin();
    await digitar(email, 'dona@');
    await digitar(senha, 'segredo123');
    await act(async () => {
      fireEvent.keyDown(email, { key: 'Enter' });
    });
    expect(loginFn).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
