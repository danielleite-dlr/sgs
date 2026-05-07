import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { VerifyEmailPendingPage } from '@/features/auth/pages/VerifyEmailPendingPage';
import { VerifyEmailSuccessPage } from '@/features/auth/pages/VerifyEmailSuccessPage';
import { InvitationPage } from '@/features/auth/pages/InvitationPage';
import { NotFoundPage } from '@/features/auth/pages/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPlaceholder } from '@/pages/DashboardPlaceholder';
import { CategoriasPage } from '@/pages/CategoriasPage';
import { ServicosPage } from '@/pages/ServicosPage';
import { PacotesPage } from '@/pages/PacotesPage';
import { ProdutosPage } from '@/pages/ProdutosPage';
import { ComissoesPage } from '@/pages/ComissoesPage';
import { ClientesPage } from '@/pages/ClientesPage';
import { ClienteDetailPage } from '@/pages/ClienteDetailPage';
import { ClienteEditPage } from '@/pages/ClienteEditPage';
import { ClienteNovoPage } from '@/pages/ClienteNovoPage';

/**
 * Application route table.
 *
 * Auth pages implemented in Phase 1 Plan 06 (frontend-auth-pages).
 * AppShell + Phase 2 routes implemented in Phase 2 Plan 02 (frontend-appshell).
 *
 * Route structure:
 *   Public routes (no AppShell):
 *     /login                    — Login screen
 *     /signup                   — Signup 2-step wizard
 *     /verificar-email          — Email verification pending
 *     /verificar-email/sucesso  — Email verified success
 *     /convite/:token           — Member invitation acceptance
 *     /recuperar-senha          — Password recovery (deferred — shows NotFoundPage)
 *     *                         — 404 NotFound
 *
 *   Protected routes (inside AppShell, require auth):
 *     /dashboard                — Dashboard placeholder
 *     /catalogo/categorias      — Categorias list (Wave 3)
 *     /catalogo/servicos        — Serviços list (Wave 3)
 *     /catalogo/pacotes         — Pacotes list (Wave 3)
 *     /catalogo/produtos        — Produtos list (Wave 3)
 *     /catalogo/comissoes       — Comissões list (Wave 3)
 *     /clientes                 — Clientes list (Wave 3)
 *     /clientes/:id             — Cliente detail (Wave 3)
 *     /clientes/:id/editar      — Cliente edit (Wave 3)
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/verificar-email',
    element: <VerifyEmailPendingPage />,
  },
  {
    path: '/verificar-email/sucesso',
    element: <VerifyEmailSuccessPage />,
  },
  {
    path: '/convite/:token',
    element: <InvitationPage />,
  },
  {
    // Password recovery deferred to post-Phase 1 — links to this route from LoginPage
    path: '/recuperar-senha',
    element: <NotFoundPage />,
  },
  {
    // Authenticated layout group — ProtectedRoute + AppShell wraps all children
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard',             element: <DashboardPlaceholder /> },
      { path: '/catalogo/categorias',   element: <CategoriasPage /> },
      { path: '/catalogo/servicos',     element: <ServicosPage /> },
      { path: '/catalogo/pacotes',      element: <PacotesPage /> },
      { path: '/catalogo/produtos',     element: <ProdutosPage /> },
      { path: '/catalogo/comissoes',    element: <ComissoesPage /> },
      { path: '/clientes',              element: <ClientesPage /> },
      { path: '/clientes/novo',         element: <ClienteNovoPage /> },
      { path: '/clientes/:id',          element: <ClienteDetailPage /> },
      { path: '/clientes/:id/editar',   element: <ClienteEditPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
