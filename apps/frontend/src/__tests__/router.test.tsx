import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import '@/infrastructure/i18n';

// Mock Apollo Client and auth API to avoid network calls
vi.mock('@/infrastructure/apollo/client', () => ({
  apolloClient: {
    query: vi.fn(),
    mutate: vi.fn(),
    watchQuery: vi.fn(() => ({ subscribe: vi.fn() })),
  },
  createApolloClient: vi.fn(),
}));

vi.mock('@/features/auth/api/auth.api', () => ({
  useLogoutMutation: () => [vi.fn(), { loading: false }],
  useLoginMutation: () => [vi.fn(), { loading: false }],
  useRefreshMutation: () => [vi.fn(), { loading: false }],
  useResendVerificationMutation: () => [vi.fn(), { loading: false }],
  useVerifyEmailMutation: () => [vi.fn(), { loading: false }],
  useAcceptInvitationMutation: () => [vi.fn(), { loading: false }],
}));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { router as appRouter } from '@/router';

describe('router phase 2', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'tok',
      userId: 'user-1',
      refreshToken: 'ref',
      memberId: 'mem-1',
      organizationId: 'org-1',
      roleName: 'ADMIN',
      permissions: [],
    });
  });

  it.each([
    '/dashboard',
    '/catalogo/categorias',
    '/catalogo/servicos',
    '/catalogo/pacotes',
    '/catalogo/produtos',
    '/catalogo/comissoes',
    '/clientes',
    '/clientes/abc',
    '/clientes/abc/editar',
  ])('renders page at %s inside AppShell', async (path) => {
    const r = createMemoryRouter(appRouter.routes, { initialEntries: [path] });
    const { unmount } = render(
      <MockedProvider mocks={[]}>
        <RouterProvider router={r} />
      </MockedProvider>,
    );

    try {
      expect(await screen.findByRole('link', { name: 'SGS — início' })).toBeInTheDocument();
    } finally {
      r.dispose();
      unmount();
    }
  });

  it('public route /login does NOT render AppShell sidebar', () => {
    useAuthStore.setState({
      accessToken: null,
      userId: null,
      refreshToken: null,
      memberId: null,
      organizationId: null,
      roleName: null,
      permissions: [],
    });
    const r = createMemoryRouter(appRouter.routes, { initialEntries: ['/login'] });
    const { unmount } = render(
      <MockedProvider mocks={[]}>
        <RouterProvider router={r} />
      </MockedProvider>,
    );

    try {
      expect(
        screen.queryByRole('navigation', { name: /Navegação principal/ }),
      ).toBeNull();
    } finally {
      r.dispose();
      unmount();
    }
  });
});
