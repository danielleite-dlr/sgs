import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, TriangleAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { brandName } from '@/lib/brand';
import { HOME_PATH } from '@/config/features';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { MENU, type MenuItem } from './menu-config';
import { BrandMark } from './BrandMark';
import { SessionUser } from './SessionUser';

export interface SidebarNavProps {
  lowStockCount?: number;
  onNavigate?: () => void;
}

const FOCO = 'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2';

/**
 * Menu lateral do computador (≥ lg), layout Gestor Beauty (D-15).
 *
 * 256 px, branco com borda à direita. Topo com a marca do estúdio; grupos de nível 0 com
 * rótulo em maiúsculas pequenas; itens de 44 px, ativo roxo cheio com texto branco; rodapé
 * com a usuária logada e o botão Sair. A árvore é a de `menu-config.ts` (já podada).
 */
export function SidebarNav({ lowStockCount = 0, onNavigate }: SidebarNavProps) {
  const organizationName = useAuthStore((s) => s.organizationName);
  const { logout } = useAuth();

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        role="navigation"
        aria-label="Navegação principal"
        className="flex h-full w-64 flex-col border-r border-neutral-200 bg-white"
      >
        <Link
          to={HOME_PATH}
          onClick={onNavigate}
          data-testid="sidebar-brand"
          aria-label={`${brandName(organizationName)} — início`}
          className={cn(
            'flex h-14 shrink-0 items-center gap-sm border-b border-neutral-200 px-md',
            FOCO,
          )}
        >
          <BrandMark organizationName={organizationName} />
          <span className="truncate font-serif text-headline-sm text-neutral-800">
            {brandName(organizationName)}
          </span>
        </Link>

        <div className="flex-1 overflow-y-auto px-sm py-md">
          <ul className="space-y-xs">
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

        <div
          data-testid="sidebar-user"
          className="flex items-center gap-sm border-t border-neutral-200 bg-neutral-100 px-md py-sm"
        >
          <SessionUser />
          <button
            type="button"
            aria-label="Sair"
            onClick={() => logout()}
            className={cn(
              'ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
              'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800',
              FOCO,
            )}
          >
            <LogOut className="h-5 w-5" />
          </button>
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

function temRotaAtiva(item: MenuItem, pathname: string): boolean {
  return (item.children ?? []).some(
    (c) => (c.to !== undefined && c.to.split('?')[0] === pathname) || temRotaAtiva(c, pathname),
  );
}

function AlertaEstoque({ count }: { count: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={`${count} produto(s) com estoque baixo`}>
          <TriangleAlert className="h-4 w-4 shrink-0 text-warning-500" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{count} produto(s) com estoque baixo</TooltipContent>
    </Tooltip>
  );
}

function SidebarItem({ item, lowStockCount, onNavigate, level }: SidebarItemProps) {
  const { pathname } = useLocation();
  const hasChildren = (item.children?.length ?? 0) > 0;
  // Grupos de nível 0 nascem abertos; subgrupos abrem sozinhos se contêm a rota atual.
  const [open, setOpen] = useState(
    hasChildren && (level === 0 || temRotaAtiva(item, pathname)),
  );
  const Icon = item.icon;
  const recuo = { paddingLeft: 8 + Math.max(level - 1, 0) * 16 };
  const alerta = item.badge === 'lowStock' && lowStockCount > 0;

  if (!hasChildren && item.to) {
    return (
      <li>
        <NavLink
          to={item.to}
          onClick={onNavigate}
          end
          aria-label={item.label}
          className={({ isActive }) =>
            cn(
              'flex min-h-[44px] items-center gap-sm rounded-md px-sm text-body transition-colors',
              FOCO,
              isActive
                ? 'bg-primary font-semibold text-white'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800',
            )
          }
          style={recuo}
        >
          {Icon && <Icon className="h-5 w-5 shrink-0" />}
          <span className="flex-1 truncate">{item.label}</span>
          {alerta && <AlertaEstoque count={lowStockCount} />}
        </NavLink>
      </li>
    );
  }

  if (!hasChildren) return null;

  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <li>
      {level === 0 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={item.label}
          className={cn(
            'mt-sm flex min-h-[44px] w-full items-center gap-xs rounded-md px-sm text-left',
            'text-overline uppercase text-neutral-500 hover:text-neutral-800',
            FOCO,
          )}
        >
          <span className="flex-1 truncate">{item.label}</span>
          {alerta && <AlertaEstoque count={lowStockCount} />}
          <Chevron className="h-4 w-4 shrink-0" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={item.label}
          className={cn(
            'flex min-h-[44px] w-full items-center gap-sm rounded-md px-sm text-left text-body',
            'font-medium text-neutral-600 transition-colors hover:bg-neutral-50',
            'hover:text-neutral-800',
            FOCO,
          )}
          style={recuo}
        >
          {Icon && <Icon className="h-5 w-5 shrink-0" />}
          <span className="flex-1 truncate">{item.label}</span>
          {alerta && <AlertaEstoque count={lowStockCount} />}
          <Chevron className="h-4 w-4 shrink-0 text-neutral-500" />
        </button>
      )}
      {open && (
        <ul className="mt-xs space-y-xs">
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
