import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlobalSearchSheet } from './GlobalSearchSheet';
import { BrandMark } from './BrandMark';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { FEATURES, HOME_PATH } from '@/config/features';
import { NotificationsBell } from '@/features/notifications/components/NotificationsBell';
import { brandName, personInitials } from '@/lib/brand';
import { formatLongDate } from '@/lib/format-date-long';

interface TopHeaderProps {
  /** Painel de notificações controlado pelo casco (a gaveta "Mais" também o abre). */
  notificationsOpen?: boolean;
  onNotificationsOpenChange?: (open: boolean) => void;
}

/**
 * Topo do layout Gestor Beauty (D-16, D-17), 56 px, branco com borda inferior.
 *
 *   Computador: │ Quinta-feira, 12 de novembro de 2026 │ … │ [Buscar páginas no SGS] 🔔 (A) │
 *   Celular:    │ [JS] Studio JS / data                 │ … │ 🔍 🔔 (A) │
 *
 * A marca do computador fica no menu lateral. Sem seletor de unidade, relógio ou
 * "Sincronizado" (D-02).
 */
export function TopHeader({ notificationsOpen, onNotificationsOpenChange }: TopHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const roleName = useAuthStore((s) => s.roleName);
  const fullName = useAuthStore((s) => s.fullName);
  const organizationName = useAuthStore((s) => s.organizationName);
  const { logout } = useAuth();
  const initial =
    personInitials(fullName).charAt(0) || (roleName ?? '?').slice(0, 1).toUpperCase();
  const hoje = formatLongDate(new Date());
  const marca = brandName(organizationName);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-md border-b border-neutral-200 bg-white px-md lg:px-lg">
        <Link
          to={HOME_PATH}
          aria-label={`${marca} — início`}
          className="flex min-w-0 items-center gap-sm lg:hidden"
        >
          <BrandMark organizationName={organizationName} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-serif text-headline-sm text-neutral-800">{marca}</span>
            <span
              data-testid="top-date-mobile"
              className="truncate text-[12px] leading-4 tabular-nums text-neutral-500"
            >
              {hoje}
            </span>
          </span>
        </Link>

        <p data-testid="top-date" className="hidden text-data tabular-nums text-neutral-800 lg:block">
          {hoje}
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-xs">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Buscar páginas no SGS"
            className="inline-flex h-11 w-11 items-center justify-center gap-sm rounded-md border border-neutral-200 bg-neutral-50 text-body text-neutral-500 transition-colors hover:border-neutral-500 hover:text-neutral-800 lg:w-[320px] lg:justify-start lg:px-[14px]"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden truncate lg:inline">Buscar páginas no SGS</span>
          </button>

          {FEATURES.notificacoes && (
            <NotificationsBell
              open={notificationsOpen}
              onOpenChange={onNotificationsOpenChange}
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Conta"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-label text-white">
                {initial}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => logout()} className="text-destructive">
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <GlobalSearchSheet open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
