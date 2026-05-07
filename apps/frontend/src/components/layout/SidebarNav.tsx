import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  TriangleAlert,
  LogOut,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { MENU, type MenuItem } from './menu-config';

export interface SidebarNavProps {
  lowStockCount?: number;
  onNavigate?: () => void;
}

/**
 * Trinks-style desktop sidebar (>=lg breakpoint).
 *
 * Renders the same hierarchical MENU as AppDrawer, but in a fixed left rail.
 * Top-level groups can be expanded/collapsed; sub-items are always visible
 * once the parent is open. Limited to 2 levels visually for desktop density.
 */
export function SidebarNav({ lowStockCount = 0, onNavigate }: SidebarNavProps) {
  const roleName = useAuthStore((s) => s.roleName);
  const { logout } = useAuth();
  const displayName = roleName ?? '—';

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        role="navigation"
        aria-label="Navegação principal"
        className="flex h-full w-[260px] flex-col bg-white border-r border-neutral-200"
      >
        <div className="flex-1 overflow-y-auto px-sm py-md">
          <ul className="space-y-px">
            {MENU.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                lowStockCount={lowStockCount}
                onNavigate={onNavigate}
                level={0}
              />
            ))}
          </ul>
        </div>

        <Separator />
        <div className="px-md py-md">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-sm rounded-md p-sm hover:bg-neutral-50 transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <span className="flex-1 truncate text-left text-sm font-semibold text-neutral-800">
                {displayName}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48">
              <DropdownMenuItem disabled>
                <Settings className="mr-sm h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => logout()}>
                <LogOut className="mr-sm h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </TooltipProvider>
  );
}

interface SidebarItemProps {
  item: MenuItem;
  lowStockCount: number;
  onNavigate?: () => void;
  level: number;
}

function SidebarItem({ item, lowStockCount, onNavigate, level }: SidebarItemProps) {
  // Open by default if it's a top-level group with children
  const [open, setOpen] = useState(level === 0 && Boolean(item.children?.length));
  const Icon = item.icon;
  const hasChildren = (item.children?.length ?? 0) > 0;
  const indent = level === 0 ? 0 : level * 12;

  if (!hasChildren && item.to) {
    return (
      <li>
        <NavLink
          to={item.to}
          onClick={onNavigate}
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-sm rounded-md py-sm pr-md text-sm transition-colors',
              'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2',
              isActive
                ? 'bg-primary-50 text-primary-500 font-semibold'
                : 'text-neutral-700 hover:bg-neutral-50',
              level === 0 ? 'font-medium' : 'font-normal',
            )
          }
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge === 'lowStock' && lowStockCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span aria-label={`${lowStockCount} produto(s) com estoque baixo`}>
                  <TriangleAlert className="h-4 w-4 text-warning-500 shrink-0" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{lowStockCount} produto(s) com estoque baixo</TooltipContent>
            </Tooltip>
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
          className={cn(
            'flex items-center gap-sm w-full rounded-md py-sm pr-md text-sm text-left transition-colors',
            'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2',
            'text-neutral-700 hover:bg-neutral-50',
            level === 0 ? 'font-semibold' : 'font-medium',
          )}
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge === 'lowStock' && lowStockCount > 0 && (
            <TriangleAlert className="h-4 w-4 text-warning-500 shrink-0" />
          )}
          {open ? (
            <ChevronDown className="h-4 w-4 text-neutral-400 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-400 shrink-0" />
          )}
        </button>
        {open && (
          <ul className="space-y-px">
            {item.children!.map((child) => (
              <SidebarItem
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
