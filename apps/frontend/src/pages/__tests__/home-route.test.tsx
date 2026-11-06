import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeRoute } from '../HomeRoute';
import { useAuthStore } from '@/infrastructure/stores/auth.store';

vi.mock('@/features/operations/components/ForecastCard', () => ({
  ForecastCard: () => <div>FORECAST</div>,
  default: () => <div>FORECAST</div>,
}));

function renderAs(roleName: string) {
  useAuthStore.setState({ roleName } as never);
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<HomeRoute />} />
        <Route path="/agenda" element={<div>AGENDA</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomeRoute (D-11)', () => {
  beforeEach(() => useAuthStore.setState({ roleName: null } as never));

  it('ADMIN vê o painel', () => {
    renderAs('ADMIN');
    expect(screen.getByRole('heading', { name: 'Início' })).toBeInTheDocument();
  });
  it('PROFESSIONAL vai para a agenda', () => {
    renderAs('PROFESSIONAL');
    expect(screen.getByText('AGENDA')).toBeInTheDocument();
  });
  it('ATTENDANT vai para a agenda', () => {
    renderAs('ATTENDANT');
    expect(screen.getByText('AGENDA')).toBeInTheDocument();
  });
});
