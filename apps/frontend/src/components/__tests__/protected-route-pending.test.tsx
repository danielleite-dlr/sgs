import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { PENDING_ROUTE_KEY } from '@/infrastructure/native/push-route';
import { ProtectedRoute } from '../ProtectedRoute';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <div>PRIVADO</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  sessionStorage.clear();
  useAuthStore.setState({ accessToken: null, userId: null });
});

describe('ProtectedRoute com rota pendente', () => {
  it('sem sessão em /agenda guarda a rota e vai para o login', () => {
    const route = '/agenda?data=2026-11-20&visao=day&agendamento=abc';
    renderAt(route);
    expect(sessionStorage.getItem(PENDING_ROUTE_KEY)).toBe(route);
    expect(screen.getByText('LOGIN')).toBeTruthy();
  });

  it('sem sessão em outra rota não guarda nada', () => {
    renderAt('/financeiro');
    expect(sessionStorage.getItem(PENDING_ROUTE_KEY)).toBeNull();
    expect(screen.getByText('LOGIN')).toBeTruthy();
  });

  it('com sessão renderiza o conteúdo e não guarda nada', () => {
    useAuthStore.setState({ accessToken: 'a', userId: 'u1' });
    renderAt('/agenda?data=2026-11-20');
    expect(screen.getByText('PRIVADO')).toBeTruthy();
    expect(sessionStorage.getItem(PENDING_ROUTE_KEY)).toBeNull();
  });
});
