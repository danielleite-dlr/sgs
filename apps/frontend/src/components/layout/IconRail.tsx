import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { TriangleAlert, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MENU, type MenuItem } from './menu-config';

const STORAGE_KEY = 'sgs:iconrail:expanded';

export interface IconRailProps {
  lowStockCount?: number;
}

/**
 * Trinks-style desktop nav rail with collapse/expand toggle.
 *
 * Collapsed (default, ~64px):
 *   ┌────┐
 *   │ 🏠 │  ← tooltip on hover, popover for groups
 *   │ 📅 │
 *   │ 🏢 │
 *   │ ›  │  ← expand
 *   └────┘
 *
 * Expanded (~240px):
 *   ┌────────────────────┐
 *   │ 🏠  Início         │  ← inline labels, accordion for groups
 *   │ 📅  Agenda         │
 *   │ 🏢  Meu Estab. ˅   │
 *   │     ├ Clientes     │
 *   │     ├ Produtos…    │
 *   │ ‹  Recolher        │
 *   └────────────────────┘
 *
 * Expanded state persists in localStorage.
 */
export function IconRail({ lowStockCount = 0 }: IconRailProps) {
  const [expanded, setExpanded] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setExpanded(true);
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    setExpanded((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        role="navigation"
        aria-label="Navegação principal"
        className={cn(
          'flex flex-col bg-primary-700 h-full transition-[width] duration-200',
          expanded ? 'w-60' : 'w-16',
        )}
      >
        <ul className={cn('flex-1 overflow-y-auto py-md space-y-px', expanded ? 'px-sm' : 'px-2 items-center flex flex-col')}>
          {MENU.map((item) => (
            <RailItem
              key={item.id}
              item={item}
              expanded={expanded}
              lowStockCount={lowStockCount}
            />
          ))}
        </ul>

        {/* Collapse / expand toggle */}
        <div className={cn('p-sm border-t border-white/10', expanded ? '' : 'flex justify-center')}>
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
            aria-expanded={expanded}
            className={cn(
              'flex items-center gap-sm rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm',
              expanded ? 'w-full px-sm py-sm' : 'h-10 w-10 justify-center',
            )}
          >
            {expanded ? (
              <>
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span>Recolher</span>
              </>
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </nav>
    </TooltipProvider>
  );
}

function RailItem({
  item,
  expanded,
  lowStockCount,
}: {
  item: MenuItem;
  expanded: boolean;
  lowStockCount: number;
}) {
  const Icon = item.icon;
  const hasChildren = (item.children?.length ?? 0) > 0;
  if (!Icon) return null;

  if (expanded) {
    return (
      <ExpandedItem item={item} lowStockCount={lowStockCount} level={0} />
    );
  }

  // Collapsed view
  const iconBox = (
    <span className="h-10 w-10 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors relative">
      <Icon className="h-5 w-5" />
      {item.badge === 'lowStock' && lowStockCount > 0 && (
        <TriangleAlert className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-warning-500" />
      )}
    </span>
  );

  if (!hasChildren && item.to) {
    return (
      <li>
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
              {iconBox}
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      </li>
    );
  }

  if (hasChildren) {
    return (
      <li>
        <CollapsedGroup item={item} icon={iconBox} lowStockCount={lowStockCount} />
      </li>
    );
  }

  return null;
}

function CollapsedGroup({
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

/**
 * Expanded mode item: icon + label, inline accordion for groups.
 * Uses dark theme (white text on primary-700).
 */
function ExpandedItem({
  item,
  lowStockCount,
  level,
}: {
  item: MenuItem;
  lowStockCount: number;
  level: number;
}) {
  const [open, setOpen] = useState(level === 0 && Boolean(item.children?.length));
  const Icon = item.icon;
  const hasChildren = (item.children?.length ?? 0) > 0;
  const padding = 8 + level * 16;

  const baseClasses =
    'flex items-center gap-sm rounded-md py-sm pr-md text-sm transition-colors w-full text-left';

  if (!hasChildren && item.to) {
    return (
      <li>
        <NavLink
          to={item.to}
          end
          className={({ isActive }) =>
            cn(
              baseClasses,
              isActive
                ? 'bg-white/15 text-white font-semibold'
                : 'text-white/80 hover:bg-white/10 hover:text-white',
            )
          }
          style={{ paddingLeft: padding }}
        >
          {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <span className="w-4" />}
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
          aria-expanded={open}
          className={cn(baseClasses, 'text-white/90 hover:bg-white/10 font-medium')}
          style={{ paddingLeft: padding }}
        >
          {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <span className="w-4" />}
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge === 'lowStock' && lowStockCount > 0 && (
            <TriangleAlert className="h-4 w-4 text-warning-500 shrink-0" />
          )}
          <ChevronRight
            className={cn('h-4 w-4 text-white/60 transition-transform', open && 'rotate-90')}
          />
        </button>
        {open && (
          <ul className="space-y-px mt-px">
            {item.children!.map((c) => (
              <ExpandedItem
                key={c.id}
                item={c}
                lowStockCount={lowStockCount}
                level={level + 1}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return null;
}
