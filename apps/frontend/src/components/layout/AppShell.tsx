import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { TopHeader } from './TopHeader';
import { BottomNav } from './BottomNav';
import { AppDrawer } from './AppDrawer';
import { ChatBubble } from './ChatBubble';
import { IconRail } from './IconRail';
import { LowStockCountQuery } from '@/features/catalog/api/produtos.api';

/**
 * AppShell — Trinks-style authenticated layout.
 *
 * Mobile (<lg):
 *   ┌─────────────────────┐
 *   │ TopHeader           │
 *   ├─────────────────────┤
 *   │ Outlet              │
 *   │                     │
 *   ├─────────────────────┤
 *   │ BottomNav (4 itens) │
 *   └─────────────────────┘
 *   AppDrawer overlays when "Menu" tapped.
 *
 * Desktop (>=lg):
 *   ┌──────┬───────────────────────────────────────┐
 *   │ Logo │ Search ─ Estab. ▼ ─ Assine ─ 🔔❓▶👤 │   ← TopHeader (h-14)
 *   ├──────┼───────────────────────────────────────┤
 *   │  🏠  │                                       │
 *   │  📅  │  Outlet                               │
 *   │  🏢  │                                       │
 *   │  💲  │                                       │
 *   │  ⚙   │                                       │
 *   └──────┴───────────────────────────────────────┘
 *   IconRail (64px) acts as primary nav.
 */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Poll every 60s for low stock — non-blocking
  const { data: lowStockData } = useQuery(LowStockCountQuery, {
    pollInterval: 60_000,
    errorPolicy: 'ignore',
  });
  const lowStockCount = lowStockData?.lowStockCount ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop icon rail */}
        <aside className="hidden lg:block sticky top-14 self-start h-[calc(100vh-3.5rem)] shrink-0">
          <IconRail lowStockCount={lowStockCount} />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-md py-md lg:px-lg lg:py-lg pb-20 lg:pb-lg min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav onOpenMenu={() => setDrawerOpen(true)} />

      {/* Mobile drawer (hierarchical menu) */}
      <AppDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        lowStockCount={lowStockCount}
      />

      {/* Floating chat bubble — persistent */}
      <ChatBubble />
    </div>
  );
}
