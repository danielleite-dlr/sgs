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
    useAuthStore.setState({ roleName: 'Ana' } as any);
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Meu Estabelecimento')).toBeInTheDocument();
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
  });

  it('shows low-stock warning icon when count > 0', () => {
    useAuthStore.setState({ roleName: 'Ana' } as any);
    render(
      <MemoryRouter>
        <SidebarNav lowStockCount={3} />
      </MemoryRouter>,
    );
    // Multiple icons (one in section header, one in sub-item) — at least one
    expect(screen.getAllByLabelText(/3 produto/).length).toBeGreaterThan(0);
  });
});
