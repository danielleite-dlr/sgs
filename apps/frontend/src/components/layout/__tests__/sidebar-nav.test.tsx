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

describe('SidebarNav (Trinks hierarchy)', () => {
  it('renders top-level menu groups', () => {
    useAuthStore.setState({ roleName: 'Ana' });
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Meu Estabelecimento')).toBeInTheDocument();
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
  });

  it('omits destinations disabled in config/features', () => {
    useAuthStore.setState({ roleName: 'Ana' });
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    );
    // Relatórios, Marketing e Configurações são mockups (Início é real desde 05-06b).
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.queryByText('Relatórios')).toBeNull();
    expect(screen.queryByText('Marketing')).toBeNull();
    expect(screen.queryByText('Configurações')).toBeNull();
  });

  it('shows low-stock warning icon when count > 0', () => {
    useAuthStore.setState({ roleName: 'Ana' });
    render(
      <MemoryRouter>
        <SidebarNav lowStockCount={3} />
      </MemoryRouter>,
    );
    // Multiple icons (one in section header, one in sub-item) — at least one
    expect(screen.getAllByLabelText(/3 produto/).length).toBeGreaterThan(0);
  });
});

// quick 261112-cko: menu principal recolhível só com os ícones.
describe('SidebarNav recolhido', () => {
  it('faixa de 64 px com ícones (nome no aria-label) e botão para expandir', async () => {
    const { fireEvent } = await import('@testing-library/react');
    useAuthStore.setState({ roleName: 'Ana' });
    const onToggle = vi.fn();
    render(
      <MemoryRouter initialEntries={['/agenda']}>
        <SidebarNav collapsed onToggleCollapsed={onToggle} />
      </MemoryRouter>,
    );
    const nav = screen.getByTestId('sidebar-collapsed');
    expect(nav).toHaveClass('w-16');
    expect(screen.queryByText('Agenda')).toBeNull();
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/agenda');
    // Grupo abre painel ao lado com os subitens.
    fireEvent.click(screen.getByRole('button', { name: 'Meu Estabelecimento' }));
    expect(await screen.findByRole('button', { name: 'Clientes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('aberto, mostra "Recolher menu" só quando há onToggleCollapsed', () => {
    useAuthStore.setState({ roleName: 'Ana' });
    const { unmount } = render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Recolher menu' })).toBeNull();
    unmount();
    render(
      <MemoryRouter>
        <SidebarNav onToggleCollapsed={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Recolher menu' })).toBeInTheDocument();
  });
});
