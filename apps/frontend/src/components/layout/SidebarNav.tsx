import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Folder as FolderIcon,
  Scissors,
  Package as PkgIcon,
  ShoppingBag,
  Percent,
  Users,
  ChevronDown,
  TriangleAlert,
  Settings,
  LogOut,
  CalendarDays,
  Receipt,
  DollarSign,
  BadgeDollarSign,
  Heart,
  FileText,
  Megaphone,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

export interface SidebarNavProps {
  lowStockCount?: number;
  onNavigate?: () => void; // mobile drawer close hook
}

const baseItem =
  'flex items-center gap-sm px-md py-sm rounded-md text-sm transition-colors ' +
  'hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2';
const activeItem = 'bg-primary-50 text-primary-500 font-semibold';
const inactiveItem = 'text-neutral-800 font-normal';

export function SidebarNav({ lowStockCount = 0, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation();
  const roleName = useAuthStore((s) => s.roleName);
  const { logout } = useAuth();
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [operacoesOpen, setOperacoesOpen] = useState(false);
  const [eventosOpen, setEventosOpen] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);

  const displayName = roleName ?? '—';

  function link(to: string, icon: React.ReactNode, label: string, extra?: React.ReactNode) {
    return (
      <NavLink
        to={to}
        onClick={onNavigate}
        className={({ isActive }) => cn(baseItem, isActive ? activeItem : inactiveItem)}
        end
      >
        {icon}
        <span className="flex-1">{label}</span>
        {extra}
      </NavLink>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        role="navigation"
        aria-label={t('navigation.primaryNavLabel')}
        className="flex h-full w-[240px] flex-col bg-background border-r border-neutral-200"
      >
        <Link
          to="/dashboard"
          className="px-lg py-lg text-2xl font-semibold text-primary-700 hover:text-primary-500 transition-colors"
        >
          SGS
        </Link>
        <Separator />
        <ul className="flex-1 overflow-y-auto px-md py-md space-y-xs list-none m-0 p-0" style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '16px', paddingBottom: '16px' }}>
          <li>
            {link(
              '/dashboard',
              <LayoutDashboard className="h-4 w-4 shrink-0" />,
              t('navigation.dashboard'),
            )}
          </li>
          <li>
            <Collapsible open={catalogOpen} onOpenChange={setCatalogOpen}>
              <CollapsibleTrigger
                className={cn(baseItem, inactiveItem, 'w-full')}
                aria-expanded={catalogOpen}
              >
                <FolderIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{t('navigation.catalog')}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform shrink-0',
                    catalogOpen ? '' : '-rotate-90',
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-md space-y-xs">
                {link(
                  '/catalogo/categorias',
                  <FolderIcon className="h-4 w-4 shrink-0" />,
                  t('navigation.categorias'),
                )}
                {link(
                  '/catalogo/servicos',
                  <Scissors className="h-4 w-4 shrink-0" />,
                  t('navigation.servicos'),
                )}
                {link(
                  '/catalogo/pacotes',
                  <PkgIcon className="h-4 w-4 shrink-0" />,
                  t('navigation.pacotes'),
                )}
                {link(
                  '/catalogo/produtos',
                  <ShoppingBag className="h-4 w-4 shrink-0" />,
                  t('navigation.produtos'),
                  lowStockCount > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          aria-label={t('navigation.lowStockTooltip', {
                            count: lowStockCount,
                          })}
                        >
                          <TriangleAlert className="h-4 w-4 text-warning-500" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('navigation.lowStockTooltip', { count: lowStockCount })}
                      </TooltipContent>
                    </Tooltip>
                  ) : null,
                )}
                {link(
                  '/catalogo/comissoes',
                  <Percent className="h-4 w-4 shrink-0" />,
                  t('navigation.comissoes'),
                )}
              </CollapsibleContent>
            </Collapsible>
          </li>
          {/* Operações — Phase 3 */}
          <li>
            <Collapsible open={operacoesOpen} onOpenChange={setOperacoesOpen}>
              <CollapsibleTrigger
                className={cn(baseItem, inactiveItem, 'w-full')}
                aria-expanded={operacoesOpen}
              >
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{t('navigation.operations', 'Operações')}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform shrink-0',
                    operacoesOpen ? '' : '-rotate-90',
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-md space-y-xs">
                {link(
                  '/agenda',
                  <CalendarDays className="h-4 w-4 shrink-0" />,
                  t('navigation.agenda', 'Agenda'),
                )}
                {link(
                  '/comanda/demo',
                  <Receipt className="h-4 w-4 shrink-0" />,
                  t('navigation.comanda', 'Comanda'),
                )}
                {link(
                  '/financeiro',
                  <DollarSign className="h-4 w-4 shrink-0" />,
                  t('navigation.financeiro', 'Financeiro'),
                )}
                {link(
                  '/financeiro/comissoes',
                  <BadgeDollarSign className="h-4 w-4 shrink-0" />,
                  t('navigation.comissoesCalculadas', 'Comissões'),
                )}
              </CollapsibleContent>
            </Collapsible>
          </li>

          {/* Eventos — Phase 4 */}
          <li>
            <Collapsible open={eventosOpen} onOpenChange={setEventosOpen}>
              <CollapsibleTrigger
                className={cn(baseItem, inactiveItem, 'w-full')}
                aria-expanded={eventosOpen}
              >
                <Heart className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{t('navigation.events', 'Eventos')}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform shrink-0',
                    eventosOpen ? '' : '-rotate-90',
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-md space-y-xs">
                {link(
                  '/noivas',
                  <Heart className="h-4 w-4 shrink-0" />,
                  t('navigation.noivas', 'Noivas'),
                )}
                {link(
                  '/contratos',
                  <FileText className="h-4 w-4 shrink-0" />,
                  t('navigation.contratos', 'Contratos'),
                )}
              </CollapsibleContent>
            </Collapsible>
          </li>

          {/* Comunicação — Phase 5 */}
          <li>
            <Collapsible open={comunicacaoOpen} onOpenChange={setComunicacaoOpen}>
              <CollapsibleTrigger
                className={cn(baseItem, inactiveItem, 'w-full')}
                aria-expanded={comunicacaoOpen}
              >
                <Megaphone className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{t('navigation.communication', 'Comunicação')}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform shrink-0',
                    comunicacaoOpen ? '' : '-rotate-90',
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-md space-y-xs">
                {link(
                  '/campanhas',
                  <Megaphone className="h-4 w-4 shrink-0" />,
                  t('navigation.campanhas', 'Campanhas'),
                )}
              </CollapsibleContent>
            </Collapsible>
          </li>

          {/* Clientes */}
          <li>
            {link(
              '/clientes',
              <Users className="h-4 w-4 shrink-0" />,
              t('navigation.clientes'),
            )}
          </li>
        </ul>
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
                {t('navigation.settings')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => logout()}>
                <LogOut className="mr-sm h-4 w-4" />
                {t('navigation.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </TooltipProvider>
  );
}
