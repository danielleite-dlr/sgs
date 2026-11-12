import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { TopHeader } from './TopHeader';
import { SidebarNav } from './SidebarNav';
import { BottomNav } from './BottomNav';
import { AppDrawer } from './AppDrawer';
import { ChatBubble } from './ChatBubble';
import { LowStockCountQuery } from '@/features/catalog/api/produtos.api';
import { FEATURES } from '@/config/features';

/**
 * AppShell — casco autenticado do layout Gestor Beauty (D-15 a D-17).
 *
 * Celular (<lg):
 *   ┌───────────────────────────────────┐
 *   │ TopHeader: marca + data · 🔍 🔔 (A) │
 *   ├───────────────────────────────────┤
 *   │ Outlet                            │
 *   ├───────────────────────────────────┤
 *   │ Agenda · Comanda · Clientes ·     │
 *   │ Noivas · Mais (BottomNav)         │
 *   └───────────────────────────────────┘
 *   "Mais" abre a AppDrawer (árvore completa, Início e Notificações).
 *
 * Computador (>=lg):
 *   ┌────────────┬──────────────────────────────────────────┐
 *   │ [JS] Marca │ Data por extenso · [Buscar páginas] 🔔 (A) │ ← TopHeader (h-14)
 *   ├────────────┼──────────────────────────────────────────┤
 *   │ GRUPO      │                                          │
 *   │  Item      │  Outlet                                  │
 *   │  …         │                                          │
 *   │ Usuária ⎋  │                                          │
 *   └────────────┴──────────────────────────────────────────┘
 *   SidebarNav (256 px, fixo na altura da tela).
 */
const SIDEBAR_KEY = 'sgs.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Menu lateral recolhido só com ícones (quick 261112-cko); lembrado neste navegador.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsed);
  function toggleSidebar() {
    setSidebarCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* sem armazenamento (aba anônima etc.): vale só nesta sessão */
      }
      return next;
    });
  }
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Poll every 60s for low stock — non-blocking
  const { data: lowStockData } = useQuery(LowStockCountQuery, {
    pollInterval: 60_000,
    errorPolicy: 'ignore',
  });
  const lowStockCount = lowStockData?.lowStockCount ?? 0;

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 lg:block ${sidebarCollapsed ? 'w-16' : 'w-64'}`}
      >
        <SidebarNav
          lowStockCount={lowStockCount}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          notificationsOpen={notificationsOpen}
          onNotificationsOpenChange={setNotificationsOpen}
        />
        <main className="min-w-0 flex-1 px-md py-md pb-20 lg:px-lg lg:py-lg lg:pb-lg">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior do celular */}
      <BottomNav onOpenMenu={() => setDrawerOpen(true)} />

      {/* Gaveta "Mais" do celular (árvore completa) */}
      <AppDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        lowStockCount={lowStockCount}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      {FEATURES.chatSuporte && <ChatBubble />}
    </div>
  );
}
