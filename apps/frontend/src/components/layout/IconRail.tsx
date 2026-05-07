import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { TriangleAlert, ChevronRight } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MENU, type MenuItem } from './menu-config';

export interface IconRailProps {
  lowStockCount?: number;
}

/**
 * Trinks-style desktop icon rail (~64px wide).
 *
 *   ┌────┐
 *   │ 🏠 │  ← Início
 *   │ 📅 │  ← Agenda
 *   │ 🏢 │  ← Meu Estabelecimento (popover with sub-items)
 *   │ 💲 │  ← Financeiro (popover)
 *   │ ❤️ │  ← Eventos (popover)
 *   │ 📊 │  ← Relatórios
 *   │ 📣 │  ← Marketing
 *   │ ⚙️ │  ← Configurações
 *   └────┘
 *
 * Icons-only with tooltip on hover. Groups with children open a
 * popover fly-out panel listing the sub-items.
 */
export function IconRail({ lowStockCount = 0 }: IconRailProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <nav
        role="navigation"
        aria-label="Navegação principal"
        className="flex w-16 flex-col items-center gap-xs bg-primary-700 py-md h-full"
      >
        {MENU.map((item) => (
          <RailItem key={item.id} item={item} lowStockCount={lowStockCount} />
        ))}
      </nav>
    </TooltipProvider>
  );
}

function RailItem({ item, lowStockCount }: { item: MenuItem; lowStockCount: number }) {
  const Icon = item.icon;
  const hasChildren = (item.children?.length ?? 0) > 0;

  if (!Icon) return null;

  const iconButton = (
    <span
      className={cn(
        'h-10 w-10 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors relative',
      )}
    >
      <Icon className="h-5 w-5" />
      {item.badge === 'lowStock' && lowStockCount > 0 && (
        <TriangleAlert className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-warning-500" />
      )}
    </span>
  );

  if (!hasChildren && item.to) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={item.to}
            end
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                'block focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-md',
                isActive && '[&_span]:bg-white/15 [&_span]:text-white',
              )
            }
          >
            {iconButton}
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  if (hasChildren) {
    return <RailItemWithChildren item={item} icon={iconButton} lowStockCount={lowStockCount} />;
  }

  return null;
}

function RailItemWithChildren({
  item,
  icon,
  lowStockCount,
}: {
  item: MenuItem;
  icon: React.ReactNode;
  lowStockCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={item.label}
              className="block focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-md"
            >
              {icon}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        {!open && <TooltipContent side="right">{item.label}</TooltipContent>}
      </Tooltip>

      <PopoverContent
        side="right"
        align="start"
        className="w-72 p-0 max-h-[80vh] overflow-y-auto"
        sideOffset={8}
      >
        <header className="px-md py-sm border-b border-neutral-200 bg-neutral-50">
          <h3 className="text-sm font-semibold text-neutral-800">{item.label}</h3>
        </header>
        <ul className="py-xs">
          {item.children!.map((child) => (
            <PopoverChild
              key={child.id}
              item={child}
              level={0}
              lowStockCount={lowStockCount}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function PopoverChild({
  item,
  level,
  lowStockCount,
  onNavigate,
}: {
  item: MenuItem;
  level: number;
  lowStockCount: number;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(level === 0);
  const hasChildren = (item.children?.length ?? 0) > 0;
  const Icon = item.icon;
  const padding = 16 + level * 16;

  if (!hasChildren && item.to) {
    return (
      <li>
        <NavLink
          to={item.to}
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-sm py-sm pr-md text-sm transition-colors',
              isActive
                ? 'bg-primary-50 text-primary-500 font-semibold'
                : 'text-neutral-700 hover:bg-neutral-50',
            )
          }
          style={{ paddingLeft: padding }}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge === 'lowStock' && lowStockCount > 0 && (
            <TriangleAlert className="h-4 w-4 text-warning-500 shrink-0" />
          )}
        </NavLink>
      </li>
    );
  }

  if (hasChildren) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-sm w-full py-sm pr-md text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
          style={{ paddingLeft: padding }}
          aria-expanded={open}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 truncate font-medium text-left">{item.label}</span>
          {item.badge === 'lowStock' && lowStockCount > 0 && (
            <TriangleAlert className="h-4 w-4 text-warning-500 shrink-0" />
          )}
          <ChevronRight
            className={cn('h-4 w-4 text-neutral-400 transition-transform', open && 'rotate-90')}
          />
        </button>
        {open && (
          <ul>
            {item.children!.map((c) => (
              <PopoverChild
                key={c.id}
                item={c}
                level={level + 1}
                lowStockCount={lowStockCount}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return null;
}
