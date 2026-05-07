import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Bell } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SidebarNav } from './SidebarNav';

export function AppShell({ lowStockCount = 0 }: { lowStockCount?: number }) {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Desktop sidebar — hidden below lg breakpoint */}
      <aside className="hidden lg:block shrink-0">
        <SidebarNav lowStockCount={lowStockCount} />
      </aside>

      {/* Right panel: mobile header + content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header (< lg) */}
        <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-card px-md lg:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('appShell.mobileMenuLabel')}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[240px]">
              <SidebarNav
                lowStockCount={lowStockCount}
                onNavigate={() => setDrawerOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <span className="truncate text-sm font-semibold text-neutral-800 max-w-[160px]">
            SGS
          </span>
          <Button
            variant="ghost"
            size="icon"
            disabled
            aria-disabled="true"
            aria-label={t('appShell.notificationsTooltip')}
          >
            <Bell className="h-5 w-5" />
          </Button>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-md py-lg lg:px-xl lg:py-lg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
