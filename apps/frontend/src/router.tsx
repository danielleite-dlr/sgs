import type { ReactElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { VerifyEmailPendingPage } from '@/features/auth/pages/VerifyEmailPendingPage';
import { VerifyEmailSuccessPage } from '@/features/auth/pages/VerifyEmailSuccessPage';
import { InvitationPage } from '@/features/auth/pages/InvitationPage';
import { NotFoundPage } from '@/features/auth/pages/NotFoundPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PlatformAdminRoute } from '@/components/PlatformAdminRoute';
import { RequirePasswordChange } from '@/components/RequirePasswordChange';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { AdminClientsPage } from '@/features/admin/pages/AdminClientsPage';
import { AppShell } from '@/components/layout/AppShell';
import { FEATURES, HOME_PATH, isPathEnabled } from '@/config/features';
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
import { ProfissionaisPage } from '@/pages/ProfissionaisPage';
// Phase 3 — Operations
import { SchedulePage } from '@/features/operations/pages/SchedulePage';
import { ComandaPage } from '@/features/operations/pages/ComandaPage';
import { FinanceiroPage } from '@/features/operations/pages/FinanceiroPage';
import { ComissoesCalculadasPage } from '@/features/operations/pages/ComissoesCalculadasPage';
// Phase 4 — Bridal / Contracts
import { BridalGroupsPlaceholder } from '@/features/bridal/pages/BridalGroupsPlaceholder';
import { ContractsPlaceholder } from '@/features/bridal/pages/ContractsPlaceholder';
import { ContractDetailPlaceholder } from '@/features/bridal/pages/ContractDetailPlaceholder';
// Phase 5 — Communication
import { CampaignsPlaceholder } from '@/features/communication/pages/CampaignsPlaceholder';
// Sub-páginas financeiras
import {
  FinanceiroCaixaPage,
  PagamentoProfissionaisPage,
  FluxoFinanceiroPage,
  DespesasPage,
  ClientesDebitoPage,
  CreditoClientePage,
  MotivosDescontoPage,
  ContasFinanceirasPage,
  ExportacaoLancamentosPage,
  LancamentoAntecipacaoPage,
} from '@/features/operations/pages/FinancialSubPages';
import { ConfiguracoesPage } from '@/pages/ConfiguracoesPage';
import { RelatoriosPage } from '@/pages/RelatoriosPage';

/**
 * Application route table.
 *
 * Auth pages implemented in Phase 1 Plan 06 (frontend-auth-pages).
 * AppShell + Phase 2 routes implemented in Phase 2 Plan 02 (frontend-appshell).
 *
 * As rotas protegidas passam por `isPathEnabled` (src/config/features.ts):
 * tudo que ainda é mockup fica fora da tabela e cai no 404, sem sumir do
 * repositório. Ligar a flag devolve a rota — veja .planning/ROADMAP-MOCKS.md.
 *
 * Route structure:
 *   Public routes (no AppShell):
 *     /login                    — Login screen
 *     /verificar-email          — Email verification pending
 *     /verificar-email/sucesso  — Email verified success
 *     /convite/:token           — Member invitation acceptance
 *     /recuperar-senha          — Password recovery (deferred — shows NotFoundPage)
 *     *                         — 404 NotFound
 *
 *   Protected routes (inside AppShell, require auth) — no ar hoje:
 *     /agenda                   — Agenda (appointments reais)
 *     /catalogo/categorias      — Categorias list
 *     /catalogo/servicos        — Serviços list
 *     /catalogo/pacotes         — Pacotes list
 *     /catalogo/produtos        — Produtos list
 *     /catalogo/comissoes       — Regras de comissão
 *     /clientes                 — Clientes list
 *     /clientes/novo            — Novo cliente form
 *     /clientes/:id             — Cliente detail
 *     /clientes/:id/editar      — Cliente edit
 *     /profissionais            — Equipe (allMembers + convites pendentes)
 *     /dashboard                — redireciona para a home vigente
 */

interface GatedRoute {
  path: string;
  element: ReactElement;
}

/** Tabela completa; o filtro abaixo decide o que vai ao ar. */
const PROTECTED_ROUTES: GatedRoute[] = [
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
  { path: '/profissionais',         element: <ProfissionaisPage /> },
  { path: '/agenda',                element: <SchedulePage /> },
  { path: '/comanda/:id',           element: <ComandaPage /> },
  { path: '/financeiro',                         element: <FinanceiroPage /> },
  { path: '/financeiro/comissoes',               element: <ComissoesCalculadasPage /> },
  { path: '/financeiro/caixa',                   element: <FinanceiroCaixaPage /> },
  { path: '/financeiro/pagamento-profissionais', element: <PagamentoProfissionaisPage /> },
  { path: '/financeiro/fluxo',                   element: <FluxoFinanceiroPage /> },
  { path: '/financeiro/despesas',                element: <DespesasPage /> },
  { path: '/financeiro/clientes-debito',         element: <ClientesDebitoPage /> },
  { path: '/financeiro/credito-cliente',         element: <CreditoClientePage /> },
  { path: '/financeiro/contas',                  element: <ContasFinanceirasPage /> },
  { path: '/financeiro/exportacao',              element: <ExportacaoLancamentosPage /> },
  { path: '/financeiro/antecipacao',             element: <LancamentoAntecipacaoPage /> },
  { path: '/financeiro/motivos-desconto',        element: <MotivosDescontoPage /> },
  { path: '/configuracoes',                      element: <ConfiguracoesPage /> },
  { path: '/configuracoes/sistema',              element: <ConfiguracoesPage /> },
  { path: '/configuracoes/adicionais',           element: <ConfiguracoesPage /> },
  { path: '/relatorios',                         element: <RelatoriosPage /> },
  { path: '/noivas',                element: <BridalGroupsPlaceholder /> },
  { path: '/contratos',             element: <ContractsPlaceholder /> },
  { path: '/contratos/:id',         element: <ContractDetailPlaceholder /> },
  { path: '/campanhas',             element: <CampaignsPlaceholder /> },
];

const enabledRoutes: GatedRoute[] = PROTECTED_ROUTES.filter((r) =>
  isPathEnabled(r.path),
);

// Enquanto a home não existe, /dashboard segue resolvendo: várias telas
// (login, troca de senha, aceite de convite, logo do header) navegam para lá.
if (!FEATURES.dashboard) {
  enabledRoutes.push({
    path: '/dashboard',
    element: <Navigate to={HOME_PATH} replace />,
  });
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to={HOME_PATH} replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
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
    // Área de plataforma: cadastro e acompanhamento dos clientes. Fora do
    // AppShell, porque um platform admin não pertence a organização nenhuma.
    path: '/admin',
    element: (
      <PlatformAdminRoute>
        <RequirePasswordChange>
          <AdminClientsPage />
        </RequirePasswordChange>
      </PlatformAdminRoute>
    ),
  },
  {
    // Senha temporária: o usuário fica preso aqui até definir a dele.
    path: '/trocar-senha',
    element: (
      <ProtectedRoute>
        <ChangePasswordPage />
      </ProtectedRoute>
    ),
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
        <RequirePasswordChange>
          <>
            <ImpersonationBanner />
            <AppShell />
          </>
        </RequirePasswordChange>
      </ProtectedRoute>
    ),
    children: enabledRoutes,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
