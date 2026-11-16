import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn(), applyAuthPayload: vi.fn() }),
}));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { TopHeader } from '../TopHeader';
import { BottomNav } from '../BottomNav';
import { AppShell } from '../AppShell';

beforeEach(() => {
  useAuthStore.setState({
    roleName: 'ADMIN',
    organizationName: 'Studio JS',
    fullName: null,
    permissions: [],
  });
});

describe('área segura do layout (C-05)', () => {
  it('o cabeçalho soma o entalhe por cima dos 56 px', () => {
    const { container } = render(
      <MockedProvider mocks={[]}>
        <MemoryRouter>
          <TopHeader />
        </MemoryRouter>
      </MockedProvider>,
    );
    const header = container.querySelector('header');
    expect(header).toHaveClass('h-14', 'box-content', 'safe-top', 'bg-white', 'border-b');
  });

  it('a barra inferior soma a barra de gestos por cima dos 64 px', () => {
    render(
      <MemoryRouter>
        <BottomNav onOpenMenu={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('bottom-nav')).toHaveClass('h-16', 'box-content', 'safe-bottom');
  });

  it('o conteúdo reserva espaço para a barra inferior mais a área segura', () => {
    const { container } = render(
      <MockedProvider mocks={[]}>
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      </MockedProvider>,
    );
    const main = container.querySelector('main');
    expect(main).toHaveClass('pb-[calc(5rem+var(--sgs-safe-bottom))]', 'lg:pb-lg');
  });
});
