import { NavLink } from 'react-router-dom';
import { CalendarDays, Gem, MoreHorizontal, Receipt, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPathEnabled } from '@/config/features';
import { useHasAccess } from '@/features/access/access-hooks';

interface BottomNavProps {
  /** Abre a gaveta "Mais" (AppDrawer). */
  onOpenMenu: () => void;
}

const ITEM =
  'flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-xs text-[11px] font-medium leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-[-2px]';

/**
 * Barra inferior do celular (D-17), escondida em ≥ lg: Agenda, Comanda, Clientes, Noivas e
 * Mais. Item desligado para a pessoa em myAccess (ou com a rota desligada em config/features) não aparece e os
 * demais dividem a largura. Início e Notificações ficam na gaveta "Mais".
 */
export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const canAgenda = useHasAccess('agenda') && isPathEnabled('/agenda');
  const canComanda = useHasAccess('fin-comandas') && isPathEnabled('/comanda');
  const canClientes = useHasAccess('clientes-todos') && isPathEnabled('/clientes');
  const canNoivas = useHasAccess('noivas') && isPathEnabled('/noivas');

  return (
    <nav
      role="navigation"
      aria-label="Navegação principal"
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-30 box-content safe-bottom flex h-16 items-stretch border-t border-neutral-200 bg-white lg:hidden"
    >
      {canAgenda && <BottomNavLink to="/agenda" label="Agenda" icon={CalendarDays} />}
      {canComanda && <BottomNavLink to="/comanda" label="Comanda" icon={Receipt} />}
      {canClientes && <BottomNavLink to="/clientes" label="Clientes" icon={Users} />}
      {canNoivas && <BottomNavLink to="/noivas" label="Noivas" icon={Gem} />}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Mais"
        className={cn(ITEM, 'text-neutral-500 hover:text-neutral-800')}
      >
        <MoreHorizontal className="h-5 w-5" />
        <span>Mais</span>
      </button>
    </nav>
  );
}

interface BottomNavLinkProps {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function BottomNavLink({ to, label, icon: Icon }: BottomNavLinkProps) {
  // Sem `end`: o item fica ativo também nas subrotas (/comanda/abc).
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          ITEM,
          isActive ? 'font-semibold text-primary-500' : 'text-neutral-500 hover:text-neutral-800',
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </NavLink>
  );
}
