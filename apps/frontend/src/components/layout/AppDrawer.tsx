import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, ChevronRight, TriangleAlert, Building, LogOut, Settings } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MENU, type MenuItem } from './menu-config';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass-through for low-stock badge count. */
  lowStockCount?: number;
}

/**
 * Trinks-style fullscreen mobile drawer.
 *
 * Layout:
 *   ┌──────────────────────────────────┐
 *   │ Estabelecimento     [trocar]    │ <- header
 *   ├──────────────────────────────────┤
 *   │ Início                          │
 *   │ Agenda                       ˅  │
 *   │   ├ Minha agenda                │
 *   │   └ Consultar agendamentos      │
 *   │ Meu Estabelecimento          ˅  │
 *   │   ├ Clientes                ˅  │
 *   │   │   ├ Todos                  │
 *   │   │   ├ Aniversariantes        │
 *   │   │   └ Ranking                │
 *   │   └ ...                         │
 *   ├──────────────────────────────────┤
 *   │ Configurações | Sair            │ <- footer
 *   └──────────────────────────────────┘
 */
export function AppDrawer({ open, onOpenChange, lowStockCount = 0 }: AppDrawerProps) {
  const { logout } = useAuth();
  const roleName = useAuthStore((s) => s.roleName);

  function handleNavigate() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full max-w-sm p-0 flex flex-col">
        <SheetHeader className="px-md py-md border-b border-neutral-200 bg-neutral-50">
          <SheetTitle className="flex items-center gap-sm text-left">
            <div className="h-9 w-9 rounded-md bg-primary-500 text-white flex items-center justify-center shrink-0">
              <Building className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-sm font-semibold text-neutral-800 truncate">
                Studio Beleza
              </span>
              <button
                type="button"
                className="text-xs text-primary-500 hover:text-primary-700 text-left"
              >
                Trocar estabelecimento ›
              </button>
            </div>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto py-sm" aria-label="Menu principal">
          <ul className="space-y-0">
            {MENU.map((item) => (
              <DrawerItem
                key={item.id}
                item={item}
                lowStockCount={lowStockCount}
                onNavigate={handleNavigate}
                level={0}
              />
            ))}
          </ul>
        </nav>

        <div className="border-t border-neutral-200 px-md py-md flex items-center justify-between gap-sm bg-neutral-50">
          <div className="flex items-center gap-sm min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center text-sm font-semibold text-primary-700 shrink-0">
              {(roleName ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-neutral-800 truncate">
                {roleName ?? '—'}
              </span>
              <button
                type="button"
                className="text-xs text-neutral-500 hover:text-neutral-800 text-left"
              >
                <Settings className="inline h-3 w-3 mr-xs" />
                Configurações
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              logout();
            }}
            className="flex items-center gap-xs text-sm text-error-500 hover:text-error-700 transition-colors px-sm py-xs"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface DrawerItemProps {
  item: MenuItem;
  lowStockCount: number;
  onNavigate: () => void;
  level: number;
}

function DrawerItem({ item, lowStockCount, onNavigate, level }: DrawerItemProps) {
  const [open, setOpen] = useState(level === 0 && item.id === 'estabelecimento');
  const Icon = item.icon;
  const hasChildren = (item.children?.length ?? 0) > 0;
  const indent = level * 16;

  if (!hasChildren && item.to) {
    return (
      <li>
        <NavLink
          to={item.to}
          onClick={onNavigate}
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-sm py-sm px-md text-sm transition-colors w-full',
              'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-[-2px]',
              isActive
                ? 'bg-primary-50 text-primary-500 font-semibold border-l-2 border-primary-500'
                : 'text-neutral-700 hover:bg-neutral-50 border-l-2 border-transparent',
            )
          }
          style={{ paddingLeft: `${16 + indent}px` }}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge === 'lowStock' && lowStockCount > 0 && (
            <TriangleAlert className="h-4 w-4 text-warning-500 shrink-0" />
          )}
        </NavLink>
      </li>
    );
  }

  if (hasChildren) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-sm py-sm px-md text-sm text-neutral-700 hover:bg-neutral-50 transition-colors w-full text-left"
          style={{ paddingLeft: `${16 + indent}px` }}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 truncate font-medium">{item.label}</span>
          {item.badge === 'lowStock' && lowStockCount > 0 && (
            <TriangleAlert className="h-4 w-4 text-warning-500 shrink-0" />
          )}
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
          )}
        </button>
        {open && (
          <ul className="space-y-0">
            {item.children!.map((child) => (
              <DrawerItem
                key={child.id}
                item={child}
                lowStockCount={lowStockCount}
                onNavigate={onNavigate}
                level={level + 1}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return null;
}
