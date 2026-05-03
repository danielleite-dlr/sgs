import { createBrowserRouter, Navigate } from 'react-router-dom';

/**
 * Application route table.
 *
 * These are placeholder routes — real pages will be implemented
 * in Phase 1 Plan 06 (frontend-auth-pages).
 *
 * Route structure matches UI-SPEC §"Navigation":
 *   /login — Login screen
 *   /signup — Signup 2-step wizard
 *   /verificar-email — Email verification pending
 *   /verificar-email/sucesso — Email verified success
 *   /convite/:token — Member invitation acceptance
 *   * — 404
 */

// Placeholder component for routes not yet implemented
function Placeholder({ name }: { name: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50">
      <section className="max-w-[400px] w-full bg-neutral-0 border border-neutral-200 rounded-lg p-xl shadow-card">
        <h1 className="text-heading text-neutral-800 mb-md">SGS — {name}</h1>
        <p className="text-body text-neutral-500">Página em construção (plano 06).</p>
      </section>
    </main>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <Placeholder name="Login" />,
  },
  {
    path: '/signup',
    element: <Placeholder name="Criar conta" />,
  },
  {
    path: '/verificar-email',
    element: <Placeholder name="Verifique seu e-mail" />,
  },
  {
    path: '/verificar-email/sucesso',
    element: <Placeholder name="E-mail verificado" />,
  },
  {
    path: '/convite/:token',
    element: <Placeholder name="Aceitar convite" />,
  },
  {
    path: '/dashboard',
    element: <Placeholder name="Painel" />,
  },
  {
    path: '*',
    element: <Placeholder name="Página não encontrada" />,
  },
]);
