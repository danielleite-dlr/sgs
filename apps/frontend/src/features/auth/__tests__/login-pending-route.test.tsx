import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@/infrastructure/i18n';

const state = vi.hoisted(() => ({
  session: { mustChangePassword: false, isPlatformAdmin: false } as Record<string, boolean>,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ applyAuthPayload: () => true, logout: vi.fn() }),
}));
vi.mock('../api/auth.api', () => ({
  useLoginMutation: () => [
    async () => ({ data: { login: { errors: [], session: state.session } } }),
    { loading: false },
  ],
}));

import { LoginPage } from '../pages/LoginPage';

const ROUTE = '/agenda?data=2026-11-20&visao=day&agendamento=a1';

async function entrar() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/agenda" element={<div>AGENDA-OK</div>} />
        <Route path="/dashboard" element={<div>DASH-OK</div>} />
        <Route path="/admin" element={<div>ADMIN-OK</div>} />
        <Route path="/trocar-senha" element={<div>TROCAR-OK</div>} />
      </Routes>
    </MemoryRouter>,
  );
  const email = document.querySelector<HTMLInputElement>('#email')!;
  const senha = document.querySelector<HTMLInputElement>('#password')!;
  await act(async () => {
    fireEvent.change(email, { target: { value: 'dona@salao.com' } });
    fireEvent.change(senha, { target: { value: 'segredo123' } });
  });
  await act(async () => {
    fireEvent.keyDown(senha, { key: 'Enter' });
  });
}

beforeEach(() => {
  sessionStorage.clear();
  state.session = { mustChangePassword: false, isPlatformAdmin: false };
});

describe('login com rota pendente', () => {
  it('abre a rota pendente e a consome', async () => {
    sessionStorage.setItem('sgs-pending-route', ROUTE);
    await entrar();
    expect(await screen.findByText('AGENDA-OK')).toBeInTheDocument();
    expect(sessionStorage.getItem('sgs-pending-route')).toBeNull();
  });

  it('sem rota pendente vai para o dashboard', async () => {
    await entrar();
    expect(await screen.findByText('DASH-OK')).toBeInTheDocument();
  });

  it('senha temporária vai para trocar-senha e mantém a rota guardada', async () => {
    sessionStorage.setItem('sgs-pending-route', ROUTE);
    state.session = { mustChangePassword: true, isPlatformAdmin: false };
    await entrar();
    expect(await screen.findByText('TROCAR-OK')).toBeInTheDocument();
    expect(sessionStorage.getItem('sgs-pending-route')).toBe(ROUTE);
  });

  it('admin de plataforma vai para /admin', async () => {
    state.session = { mustChangePassword: false, isPlatformAdmin: true };
    await entrar();
    expect(await screen.findByText('ADMIN-OK')).toBeInTheDocument();
  });
});
