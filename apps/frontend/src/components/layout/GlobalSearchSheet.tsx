import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { searchMenu, flattenMenu, type MenuItem } from './menu-config';

interface GlobalSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Trinks-style global search.
 *
 * Searches the entire menu tree (including sub-items) by label and searchTerms.
 * Empty query shows a "Recentes / Sugestões" panel.
 */
export function GlobalSearchSheet({ open, onOpenChange }: GlobalSearchSheetProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Reset query when closing
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Keyboard shortcut: Ctrl/Cmd+K opens search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const results = query.trim()
    ? searchMenu(query)
    : flattenMenu().slice(0, 8); // top 8 as "sugestões" when empty

  function handleSelect(item: MenuItem) {
    if (item.to) {
      navigate(item.to);
      onOpenChange(false);
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar páginas no SGS…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nenhuma página encontrada.</CommandEmpty>
        <CommandGroup heading={query.trim() ? 'Resultados' : 'Sugestões'}>
          {results.map(({ item, path }) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${path.join(' ')}`}
              onSelect={() => handleSelect(item)}
              className="cursor-pointer"
            >
              <Search className="h-4 w-4 text-neutral-400 mr-sm shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-neutral-800 truncate">
                  {item.label}
                </span>
                {path.length > 1 && (
                  <span className="text-xs text-neutral-500 truncate">
                    {path.slice(0, -1).join(' › ')}
                  </span>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
