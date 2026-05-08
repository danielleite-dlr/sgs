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
// Phase 3 — Operations mockups
import { SchedulePage } from '@/features/operations/pages/SchedulePage';
import { ComandaPage } from '@/features/operations/pages/ComandaPage';
import { FinanceiroPage } from '@/features/operations/pages/FinanceiroPage';
import { ComissoesCalculadasPage } from '@/features/operations/pages/ComissoesCalculadasPage';
// Phase 4 — Bridal / Contracts placeholder stubs (Agent 2 will replace file contents)
import { BridalGroupsPlaceholder } from '@/features/bridal/pages/BridalGroupsPlaceholder';
import { ContractsPlaceholder } from '@/features/bridal/pages/ContractsPlaceholder';
import { ContractDetailPlaceholder } from '@/features/bridal/pages/ContractDetailPlaceholder';
// Phase 5 — Communication placeholder stubs (Agent 3 will replace file contents)
import { CampaignsPlaceholder } from '@/features/communication/pages/CampaignsPlaceholder';
// Trinks-style financial sub-pages (mockups)
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
 * Phase 3 mockups + Phase 4/5 stub routes added here (mockups plan).
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
 *     Phase 1+2 (live):
 *     /dashboard                — Dashboard placeholder
 *     /catalogo/categorias      — Categorias list
 *     /catalogo/servicos        — Serviços list
 *     /catalogo/pacotes         — Pacotes list
 *     /catalogo/produtos        — Produtos list
 *     /catalogo/comissoes       — Comissões list
 *     /clientes                 — Clientes list
 *     /clientes/novo            — Novo cliente form
 *     /clientes/:id             — Cliente detail
 *     /clientes/:id/editar      — Cliente edit
 *
 *     Phase 3 (mockups — no backend wired):
 *     /agenda                   — SchedulePage (calendar week view, mock data)
 *     /comanda/:id              — ComandaPage (POS / receipt, mock data)
 *     /financeiro               — FinanceiroPage (dashboard + charts, mock data)
 *     /financeiro/comissoes     — ComissoesCalculadasPage (table, mock data)
 *
 *     Phase 4 (stubs — Agent 2 will replace file contents):
 *     /noivas                   — BridalGroupsPlaceholder
 *     /contratos                — ContractsPlaceholder
 *     /contratos/:id            — ContractDetailPlaceholder
 *
 *     Phase 5 (stubs — Agent 3 will replace file contents):
 *     /campanhas                — CampaignsPlaceholder
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
      // Phase 3 — Operations mockups
      { path: '/agenda',                element: <SchedulePage /> },
      { path: '/comanda/:id',           element: <ComandaPage /> },
      { path: '/financeiro',                       element: <FinanceiroPage /> },
      { path: '/financeiro/comissoes',             element: <ComissoesCalculadasPage /> },
      { path: '/financeiro/caixa',                 element: <FinanceiroCaixaPage /> },
      { path: '/financeiro/pagamento-profissionais', element: <PagamentoProfissionaisPage /> },
      { path: '/financeiro/fluxo',                 element: <FluxoFinanceiroPage /> },
      { path: '/financeiro/despesas',              element: <DespesasPage /> },
      { path: '/financeiro/clientes-debito',       element: <ClientesDebitoPage /> },
      { path: '/financeiro/credito-cliente',       element: <CreditoClientePage /> },
      { path: '/financeiro/contas',                element: <ContasFinanceirasPage /> },
      { path: '/financeiro/exportacao',            element: <ExportacaoLancamentosPage /> },
      { path: '/financeiro/antecipacao',           element: <LancamentoAntecipacaoPage /> },
      { path: '/financeiro/motivos-desconto',      element: <MotivosDescontoPage /> },
      // Configurações & Relatórios
      { path: '/configuracoes',                    element: <ConfiguracoesPage /> },
      { path: '/configuracoes/sistema',            element: <ConfiguracoesPage /> },
      { path: '/configuracoes/adicionais',         element: <ConfiguracoesPage /> },
      { path: '/relatorios',                       element: <RelatoriosPage /> },
      // Phase 4 — Bridal / Contracts stubs (Agent 2 replaces contents)
      { path: '/noivas',                element: <BridalGroupsPlaceholder /> },
      { path: '/contratos',             element: <ContractsPlaceholder /> },
      { path: '/contratos/:id',         element: <ContractDetailPlaceholder /> },
      // Phase 5 — Communication stubs (Agent 3 replaces contents)
      { path: '/campanhas',             element: <CampaignsPlaceholder /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
