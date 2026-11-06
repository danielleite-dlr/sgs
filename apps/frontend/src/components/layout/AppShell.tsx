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
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Poll every 60s for low stock — non-blocking
  const { data: lowStockData } = useQuery(LowStockCountQuery, {
    pollInterval: 60_000,
    errorPolicy: 'ignore',
  });
  const lowStockCount = lowStockData?.lowStockCount ?? 0;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <SidebarNav lowStockCount={lowStockCount} />
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
