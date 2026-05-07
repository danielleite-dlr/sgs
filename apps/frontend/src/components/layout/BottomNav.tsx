import { NavLink } from 'react-router-dom';
import { Home, Bell, CalendarDays, Menu as MenuIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  /** Triggers AppDrawer open. */
  onOpenMenu: () => void;
  /** Pending notifications count for the badge. */
  notificationsCount?: number;
}

/**
 * Trinks-style mobile bottom navigation (4 fixed items).
 * Hidden on lg+ breakpoints.
 *
 * Items:
 *   1. Início    — /dashboard
 *   2. Notificações — opens notifications panel (placeholder for now)
 *   3. Agenda    — /agenda (operational center)
 *   4. Menu      — opens AppDrawer (hierarchical 3-level tree)
 */
export function BottomNav({ onOpenMenu, notificationsCount = 0 }: BottomNavProps) {
  return (
    <nav
      role="navigation"
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch justify-around border-t border-neutral-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)] lg:hidden"
    >
      <BottomNavLink to="/dashboard" label="Início" icon={Home} />
      <BottomNavButton
        label="Notificações"
        icon={Bell}
        onClick={() => {
          /* placeholder — opens notifications panel later */
        }}
        badgeCount={notificationsCount}
      />
      <BottomNavLink to="/agenda" label="Agenda" icon={CalendarDays} highlighted />
      <BottomNavButton label="Menu" icon={MenuIcon} onClick={onOpenMenu} />
    </nav>
  );
}

interface BottomNavLinkProps {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlighted?: boolean;
}

function BottomNavLink({ to, label, icon: Icon, highlighted }: BottomNavLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center justify-center gap-0.5 px-xs min-w-[64px] flex-1 transition-colors',
          'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-[-2px]',
          isActive
            ? 'text-primary-500 font-semibold'
            : 'text-neutral-500 hover:text-neutral-800',
          highlighted && !isActive && 'text-primary-500',
        )
      }
      end
    >
      <Icon className="h-5 w-5" />
      <span className="text-[11px] leading-tight">{label}</span>
    </NavLink>
  );
}

interface BottomNavButtonProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  badgeCount?: number;
}

function BottomNavButton({ label, icon: Icon, onClick, badgeCount = 0 }: BottomNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex flex-col items-center justify-center gap-0.5 px-xs min-w-[64px] flex-1 text-neutral-500 hover:text-neutral-800 transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-[-2px] relative"
    >
      <span className="relative">
        <Icon className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] rounded-full bg-error-500 text-white text-[10px] font-semibold flex items-center justify-center px-[3px]">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </span>
      <span className="text-[11px] leading-tight">{label}</span>
    </button>
  );
}
