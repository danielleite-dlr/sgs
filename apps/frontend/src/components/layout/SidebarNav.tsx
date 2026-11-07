import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, TriangleAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { brandName } from '@/lib/brand';
import { HOME_PATH } from '@/config/features';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { MENU, type MenuItem } from './menu-config';
import { contemAvisoEstoque, temRotaAtiva, useMenuAccordion } from './use-menu-accordion';
import { BrandMark } from './BrandMark';
import { SessionUser } from './SessionUser';

export interface SidebarNavProps {
  lowStockCount?: number;
  onNavigate?: () => void;
}

const FOCO = 'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2';
const INATIVO = 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900';
// Item de 1º nível ativo (D-26): lilás claro, texto roxo escuro, ícone roxo.
const ATIVO_1 =
  'bg-primary-50 font-semibold text-primary-900 [&>svg:first-child]:text-primary-500';
// Subitem ativo (D-26): roxo de selecionado com texto branco.
const ATIVO_SUB = 'bg-primary-800 font-semibold text-white';

/**
 * Menu lateral do computador (≥ lg), layout Gestor Beauty (D-15).
 *
 * 256 px, branco com borda à direita. Topo com a marca do estúdio; grupos de nível 0 com
 * rótulo em maiúsculas pequenas; itens de 44 px. Ativo no padrão da Previsão de caixa (D-26):
 * item de 1º nível (e o subgrupo que contém a rota atual) em lilás claro com texto roxo escuro
 * e ícone roxo; subitem ativo roxo #521873 com texto branco. Rodapé com a usuária logada e o
 * botão Sair. A árvore é a de `menu-config.ts` (já podada).
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
          <SidebarList
            items={MENU}
            className="space-y-xs"
            lowStockCount={lowStockCount}
            onNavigate={onNavigate}
            level={0}
          />
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

interface SidebarListProps {
  items: MenuItem[];
  className: string;
  lowStockCount: number;
  onNavigate?: () => void;
  level: number;
}

// Lista de irmãos em acordeão (quick 261107-j9q): um menu com submenus aberto por vez.
function SidebarList({ items, className, lowStockCount, onNavigate, level }: SidebarListProps) {
  const { openId, toggle } = useMenuAccordion(items);
  return (
    <ul className={className}>
      {items.map((item) => (
        <SidebarItem
          key={item.id}
          item={item}
          open={openId === item.id}
          onToggle={() => toggle(item.id)}
          lowStockCount={lowStockCount}
          onNavigate={onNavigate}
          level={level}
        />
      ))}
    </ul>
  );
}

interface SidebarItemProps {
  item: MenuItem;
  open: boolean;
  onToggle: () => void;
  lowStockCount: number;
  onNavigate?: () => void;
  level: number;
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

function SidebarItem({
  item,
  open,
  onToggle,
  lowStockCount,
  onNavigate,
  level,
}: SidebarItemProps) {
  const { pathname } = useLocation();
  const hasChildren = (item.children?.length ?? 0) > 0;
  const Icon = item.icon;
  const recuo = { paddingLeft: 8 + Math.max(level - 1, 0) * 16 };
  // Menu fechado herda o aviso de estoque baixo de um descendente, para não sumir no acordeão.
  const alerta =
    lowStockCount > 0 && (item.badge === 'lowStock' || (!open && contemAvisoEstoque(item)));
  // Item com ícone nos níveis 0 e 1 é de 1º nível no Stitch; sem ícone ou do nível 2 em
  // diante é subitem (D-26).
  const ehSubitem = level >= 2 || !Icon;

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
              isActive ? (ehSubitem ? ATIVO_SUB : ATIVO_1) : INATIVO,
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
          onClick={onToggle}
          aria-expanded={open}
          aria-label={item.label}
          className={cn(
            'mt-sm flex min-h-[44px] w-full items-center gap-xs rounded-md px-sm text-left',
            'text-[10px] font-semibold uppercase tracking-widest text-neutral-500',
            'hover:text-neutral-900',
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
          onClick={onToggle}
          aria-expanded={open}
          aria-label={item.label}
          className={cn(
            'flex min-h-[44px] w-full items-center gap-sm rounded-md px-sm text-left text-body',
            'font-medium transition-colors',
            temRotaAtiva(item, pathname) ? ATIVO_1 : INATIVO,
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
        <SidebarList
          items={item.children!}
          className="mt-xs space-y-xs"
          lowStockCount={lowStockCount}
          onNavigate={onNavigate}
          level={level + 1}
        />
      )}
    </li>
  );
}
