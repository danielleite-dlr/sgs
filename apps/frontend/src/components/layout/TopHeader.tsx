import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearchSheet } from './GlobalSearchSheet';

interface TopHeaderProps {
  /** When true, hides the mobile-only menu button rendered by AppShell. */
  withMobileMenu?: boolean;
}

/**
 * Trinks-style top header.
 *
 * Layout:
 *   [Logo SGS]              [CTA central — plano/upgrade]              [🔍 Buscar]
 *
 * Persists across all breakpoints. Mobile menu button (when needed) is
 * rendered separately by AppShell on the mobile header strip.
 */
export function TopHeader(_props: TopHeaderProps = {}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-md border-b border-neutral-200 bg-white px-md lg:px-lg">
        {/* Logo */}
        <Link
          to="/dashboard"
          className="flex items-center gap-xs text-lg font-semibold text-primary-700 hover:text-primary-500 transition-colors shrink-0"
        >
          SGS
        </Link>

        {/* CTA central — status do plano (mockup) */}
        <Link
          to="/configuracoes/plano"
          className="hidden sm:flex items-center gap-xs rounded-full border border-warning-500 bg-warning-50 px-md py-xs text-xs font-medium text-warning-700 hover:bg-warning-100 transition-colors max-w-[420px] truncate"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Seu teste grátis termina em <strong className="font-semibold">12 dias</strong> — Assine agora
          </span>
        </Link>

        {/* Busca global */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Buscar páginas no SGS"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>
      </header>

      <GlobalSearchSheet open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
