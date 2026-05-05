import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { VerifyEmailPendingPage } from '@/features/auth/pages/VerifyEmailPendingPage';
import { VerifyEmailSuccessPage } from '@/features/auth/pages/VerifyEmailSuccessPage';
import { InvitationPage } from '@/features/auth/pages/InvitationPage';
import { NotFoundPage } from '@/features/auth/pages/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardPlaceholder } from '@/pages/DashboardPlaceholder';

/**
 * Application route table.
 *
 * Auth pages implemented in Phase 1 Plan 06 (frontend-auth-pages).
 *
 * Route structure matches UI-SPEC §"Navigation":
 *   /login                    — Login screen
 *   /signup                   — Signup 2-step wizard
 *   /verificar-email          — Email verification pending
 *   /verificar-email/sucesso  — Email verified success
 *   /convite/:token           — Member invitation acceptance
 *   /recuperar-senha          — Password recovery (deferred — shows NotFoundPage)
 *   /dashboard                — Protected dashboard placeholder
 *   *                         — 404 NotFound
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
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPlaceholder />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
