import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  TriangleAlert,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  /** Recolhido: faixa de 64 px só com os ícones (quick 261112-cko). */
  collapsed?: boolean;
  /** Sem ele o botão de recolher não aparece (a gaveta do celular não recolhe). */
  onToggleCollapsed?: () => void;
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
export function SidebarNav({
  lowStockCount = 0,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: SidebarNavProps) {
  const organizationName = useAuthStore((s) => s.organizationName);
  const { logout } = useAuth();

  if (collapsed) {
    return (
      <CollapsedSidebar
        lowStockCount={lowStockCount}
        organizationName={organizationName}
        onExpand={onToggleCollapsed}
        onLogout={() => logout()}
      />
    );
  }

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

        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            data-testid="sidebar-collapse"
            aria-label="Recolher menu"
            className={cn(
              'flex min-h-[44px] items-center gap-sm border-t border-neutral-200 px-md text-body',
              INATIVO,
              FOCO,
            )}
          >
            <PanelLeftClose className="h-5 w-5 shrink-0" />
            <span>Recolher menu</span>
          </button>
        )}

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
  // Todo item tem ícone (quick 261107-jvl), então o nível decide o ativo (D-26): folha solta
  // no topo (Início) é de 1º nível; folha dentro de um grupo é subitem roxo.
  const ehSubitem = level >= 1;

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
          <Icon className="h-5 w-5 shrink-0" />
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
          <Icon className="h-4 w-4 shrink-0" />
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
          <Icon className="h-5 w-5 shrink-0" />
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

// ─── Menu recolhido (quick 261112-cko) ─────────────────────────────────────────

const ICONE =
  'flex h-11 w-11 items-center justify-center rounded-md transition-colors [&>svg]:h-5 [&>svg]:w-5';

interface CollapsedSidebarProps {
  lowStockCount: number;
  organizationName: string | null;
  onExpand?: () => void;
  onLogout: () => void;
}

/**
 * Faixa de 64 px com um ícone por item de 1º nível. Link direto (Início, Agenda) navega; grupo
 * abre um painel ao lado com a mesma árvore do menu aberto, para não ter que expandir o menu.
 */
function CollapsedSidebar({
  lowStockCount,
  organizationName,
  onExpand,
  onLogout,
}: CollapsedSidebarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <nav
        role="navigation"
        aria-label="Navegação principal"
        data-testid="sidebar-collapsed"
        className="flex h-full w-16 flex-col items-center border-r border-neutral-200 bg-white"
      >
        <Link
          to={HOME_PATH}
          data-testid="sidebar-brand"
          aria-label={`${brandName(organizationName)} — início`}
          className={cn(
            'flex h-14 w-full shrink-0 items-center justify-center border-b border-neutral-200',
            FOCO,
          )}
        >
          <BrandMark organizationName={organizationName} />
        </Link>

        <ul className="flex w-full flex-1 flex-col items-center gap-xs overflow-y-auto py-md">
          {MENU.map((item) => (
            <CollapsedItem key={item.id} item={item} lowStockCount={lowStockCount} />
          ))}
        </ul>

        <div className="flex w-full flex-col items-center gap-xs border-t border-neutral-200 bg-neutral-100 py-sm">
          {onExpand && (
            <IconTooltip label="Expandir menu">
              <button
                type="button"
                onClick={onExpand}
                data-testid="sidebar-collapse"
                aria-label="Expandir menu"
                className={cn(ICONE, INATIVO, FOCO)}
              >
                <PanelLeftOpen />
              </button>
            </IconTooltip>
          )}
          <IconTooltip label="Sair">
            <button
              type="button"
              aria-label="Sair"
              onClick={onLogout}
              className={cn(ICONE, 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800', FOCO)}
            >
              <LogOut />
            </button>
          </IconTooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}

function IconTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function CollapsedItem({ item, lowStockCount }: { item: MenuItem; lowStockCount: number }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const Icon = item.icon;
  const alerta = lowStockCount > 0 && (item.badge === 'lowStock' || contemAvisoEstoque(item));
  const ponto = alerta && (
    <span
      aria-hidden="true"
      className="absolute right-1 top-1 h-2 w-2 rounded-full bg-warning-500"
    />
  );

  if (!item.children?.length) {
    if (!item.to) return null;
    // Link comum com className em texto: o Slot do Tooltip (asChild) concatena a className e
    // estragaria a função do NavLink.
    const ativoLink = pathname === item.to.split('?')[0];
    return (
      <li>
        <IconTooltip label={item.label}>
          <Link
            to={item.to}
            aria-label={item.label}
            aria-current={ativoLink ? 'page' : undefined}
            className={cn(ICONE, 'relative', FOCO, ativoLink ? ATIVO_1 : INATIVO)}
          >
            <Icon />
            {ponto}
          </Link>
        </IconTooltip>
      </li>
    );
  }

  const ativo = temRotaAtiva(item, pathname);
  return (
    <li>
      <Popover open={open} onOpenChange={setOpen}>
        <IconTooltip label={item.label}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={item.label}
              className={cn(ICONE, 'relative', FOCO, ativo ? ATIVO_1 : INATIVO)}
            >
              <Icon />
              {ponto}
            </button>
          </PopoverTrigger>
        </IconTooltip>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="max-h-[80vh] w-64 overflow-y-auto p-sm"
        >
          <p className="px-sm pb-xs text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            {item.label}
          </p>
          <SidebarList
            items={item.children}
            className="space-y-xs"
            lowStockCount={lowStockCount}
            onNavigate={() => setOpen(false)}
            level={1}
          />
        </PopoverContent>
      </Popover>
    </li>
  );
}
