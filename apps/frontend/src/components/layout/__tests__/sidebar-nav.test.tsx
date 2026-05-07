import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@/infrastructure/i18n';

// Mock the useAuth hook to avoid router dependency
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn(), applyAuthPayload: vi.fn() }),
}));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { SidebarNav } from '../SidebarNav';

describe('SidebarNav', () => {
  it('renders all 7 nav labels in pt-BR', () => {
    useAuthStore.setState({ roleName: 'Ana' } as any);
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('Painel')).toBeInTheDocument();
    expect(screen.getByText('Catálogo')).toBeInTheDocument();
    expect(screen.getByText('Categorias')).toBeInTheDocument();
    expect(screen.getByText('Serviços')).toBeInTheDocument();
    expect(screen.getByText('Pacotes')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.getByText('Comissões')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
  });

  it('shows low-stock warning icon when count > 0', () => {
    useAuthStore.setState({ roleName: 'Ana' } as any);
    render(
      <MemoryRouter>
        <SidebarNav lowStockCount={3} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/3 produto/)).toBeInTheDocument();
  });
});
