import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { MenuItem } from './menu-config';

/** O item (ou algum descendente dele) aponta para a rota atual. */
export function temRotaAtiva(item: MenuItem, pathname: string): boolean {
  return (item.children ?? []).some(
    (c) => (c.to !== undefined && c.to.split('?')[0] === pathname) || temRotaAtiva(c, pathname),
  );
}

function ramoDaRota(items: MenuItem[], pathname: string): string | null {
  return items.find((i) => temRotaAtiva(i, pathname))?.id ?? null;
}

/**
 * Acordeão de uma lista de irmãos do menu (quick 261107-j9q): no máximo um menu com
 * submenus aberto por nível. Abrir um fecha o irmão que estava aberto; clicar no aberto
 * fecha. Nasce aberto só o ramo da rota atual (ou `fallbackId`) e, quando a rota muda para
 * outro ramo (link dentro da página), o menu acompanha.
 */
export function useMenuAccordion(items: MenuItem[], fallbackId?: string) {
  const { pathname } = useLocation();
  const [openId, setOpenId] = useState<string | null>(
    () => ramoDaRota(items, pathname) ?? fallbackId ?? null,
  );
  const rotaAnterior = useRef(pathname);

  useEffect(() => {
    if (rotaAnterior.current === pathname) return;
    rotaAnterior.current = pathname;
    const id = ramoDaRota(items, pathname);
    if (id) setOpenId(id);
  }, [items, pathname]);

  const toggle = useCallback((id: string) => setOpenId((v) => (v === id ? null : id)), []);

  return { openId, toggle };
}

/** Algum descendente tem o aviso de estoque baixo (mostrado no menu fechado que o contém). */
export function contemAvisoEstoque(item: MenuItem): boolean {
  return (item.children ?? []).some((c) => c.badge === 'lowStock' || contemAvisoEstoque(c));
}
