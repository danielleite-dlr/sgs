import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Search, Bell, HelpCircle, PlayCircle, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GlobalSearchSheet } from './GlobalSearchSheet';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * Trinks-style top header.
 *
 *   ┌──────┬──────────────────────────────────────────────────────────────────┐
 *   │ Logo │ 🔍 Buscar páginas │ Estabelecimento ▼ │ Assine │ 🔔 ❓ ▶ 👤        │
 *   └──────┴──────────────────────────────────────────────────────────────────┘
 *
 * Logo lives in the icon rail's color band on the left (h-14 matched).
 * Other elements collapse on small screens. Bell/help/play are decorative.
 */
export function TopHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const roleName = useAuthStore((s) => s.roleName);
  const { logout } = useAuth();
  const initial = (roleName ?? '?').slice(0, 1).toUpperCase();

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <header className="sticky top-0 z-40 flex h-14 items-stretch border-b border-neutral-200 bg-white">
          {/* Logo (matches icon rail width on desktop) */}
          <Link
            to="/dashboard"
            className="hidden lg:flex w-16 items-center justify-center bg-primary-700 text-white shrink-0 hover:bg-primary-500 transition-colors"
            aria-label="SGS — início"
          >
            <span className="text-lg font-bold tracking-tight">SGS</span>
          </Link>

          {/* Mobile logo */}
          <Link
            to="/dashboard"
            className="flex lg:hidden items-center pl-md text-lg font-semibold text-primary-700"
          >
            SGS
          </Link>

          {/* Search */}
          <div className="flex-1 flex items-center px-md min-w-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-sm w-full max-w-[420px] rounded-full border border-neutral-200 bg-neutral-50 px-md py-xs text-sm text-neutral-500 hover:border-primary-300 hover:text-neutral-700 transition-colors"
              aria-label="Buscar páginas no SGS"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Buscar páginas no SGS</span>
              <kbd className="hidden sm:inline ml-auto text-[10px] text-neutral-400 font-mono">⌘K</kbd>
            </button>
          </div>

          {/* Estabelecimento selector */}
          <div className="hidden md:flex items-center px-md border-l border-neutral-200">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-xs text-sm font-medium text-neutral-700 hover:text-primary-500 transition-colors max-w-[220px]">
                <span className="truncate">Studio Beleza LTDA</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem disabled>Studio Beleza LTDA (atual)</DropdownMenuItem>
                <DropdownMenuItem disabled>+ Adicionar estabelecimento</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Assine agora — green pill */}
          <div className="hidden sm:flex items-center pr-md">
            <Link
              to="/configuracoes/plano"
              className="flex items-center gap-xs rounded-full bg-success-500 px-md py-xs text-xs font-semibold text-white hover:bg-success-600 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Assine agora
            </Link>
          </div>

          {/* Decorative actions */}
          <div className="flex items-center gap-xs px-md border-l border-neutral-200">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" disabled aria-label="Notificações">
                  <Bell className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notificações (em breve)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" disabled aria-label="Ajuda">
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ajuda</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" disabled aria-label="Tutoriais">
                  <PlayCircle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tutoriais</TooltipContent>
            </Tooltip>

            {/* Avatar / user menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="h-8 w-8 rounded-full bg-primary-50 text-primary-700 font-semibold flex items-center justify-center hover:ring-2 hover:ring-primary-500/20 transition-all">
                {initial}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem disabled>Perfil</DropdownMenuItem>
                <DropdownMenuItem disabled>Área pessoal</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => logout()} className="text-error-500">
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      </TooltipProvider>

      <GlobalSearchSheet open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
