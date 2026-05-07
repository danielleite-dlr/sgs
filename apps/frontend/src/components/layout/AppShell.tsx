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

      <div className="flex flex-1 items-stretch">
        {/* Desktop icon rail — stretches to full page (flex column) height */}
        <aside className="hidden lg:flex shrink-0 self-stretch">
          <IconRail lowStockCount={lowStockCount} />
        </aside>

        {/* Main content */}
        <main className="flex-1 px-md py-md lg:px-lg lg:py-lg pb-20 lg:pb-lg min-w-0">
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
