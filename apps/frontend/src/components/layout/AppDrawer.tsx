import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Bell, ChevronDown, ChevronRight, LogOut, TriangleAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { brandName } from '@/lib/brand';
import { FEATURES } from '@/config/features';
import { MENU, type MenuItem } from './menu-config';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { BrandMark } from './BrandMark';
import { SessionUser } from './SessionUser';

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass-through for low-stock badge count. */
  lowStockCount?: number;
  /** Abre o painel de notificações do topo (o sino continua lá). */
  onOpenNotifications?: () => void;
}

const FOCO = 'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-[-2px]';

/**
 * Gaveta "Mais" do celular (D-17): marca do estúdio, Notificações, a árvore completa de
 * `menu-config.ts` (Início incluído) e, no rodapé, a usuária logada e Sair.
 */
export function AppDrawer({
  open,
  onOpenChange,
  lowStockCount = 0,
  onOpenNotifications,
}: AppDrawerProps) {
  const { logout } = useAuth();
  const organizationName = useAuthStore((s) => s.organizationName);

  function handleNavigate() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-full max-w-sm flex-col p-0">
        <SheetHeader className="border-b border-neutral-200 bg-white px-md py-md">
          <SheetTitle className="flex items-center gap-sm text-left">
            <BrandMark organizationName={organizationName} />
            <span className="truncate font-serif text-headline-sm text-neutral-800">
              {brandName(organizationName)}
            </span>
          </SheetTitle>
        </SheetHeader>

        {FEATURES.notificacoes && onOpenNotifications && (
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onOpenNotifications();
            }}
            className={cn(
              'flex min-h-[44px] w-full items-center gap-sm border-b border-neutral-200 px-md',
              'text-body text-neutral-800 hover:bg-neutral-50',
              FOCO,
            )}
          >
            <Bell className="h-5 w-5" />
            Notificações
          </button>
        )}

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

        <div className="flex items-center justify-between gap-sm border-t border-neutral-200 bg-neutral-100 px-md py-sm">
          <SessionUser />
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              logout();
            }}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-xs rounded-md px-sm text-body',
              'text-error-600 hover:bg-error-50',
              FOCO,
            )}
          >
            <LogOut className="h-4 w-4" />
            Sair
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
  const recuo = { paddingLeft: `${16 + level * 16}px` };
  const alerta = item.badge === 'lowStock' && lowStockCount > 0 && (
    <TriangleAlert className="h-4 w-4 shrink-0 text-warning-500" />
  );

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
              'flex min-h-[44px] w-full items-center gap-sm px-md text-body transition-colors',
              FOCO,
              // Mesmo ativo do menu lateral (D-26): 1º nível lilás claro, subitem roxo.
              isActive
                ? level >= 2 || !Icon
                  ? 'bg-primary-800 font-semibold text-white'
                  : 'bg-primary-50 font-semibold text-primary-900 [&>svg:first-child]:text-primary-500'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
            )
          }
          style={recuo}
        >
          {Icon && <Icon className="h-5 w-5 shrink-0" />}
          <span className="flex-1 truncate">{item.label}</span>
          {alerta}
        </NavLink>
      </li>
    );
  }

  if (!hasChildren) return null;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={item.label}
        className={cn(
          'flex min-h-[44px] w-full items-center gap-sm px-md text-left text-body font-medium',
          'text-neutral-800 transition-colors hover:bg-neutral-50',
          FOCO,
        )}
        style={recuo}
      >
        {Icon && <Icon className="h-5 w-5 shrink-0" />}
        <span className="flex-1 truncate">{item.label}</span>
        {alerta}
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" />
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
