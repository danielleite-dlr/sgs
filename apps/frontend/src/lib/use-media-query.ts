import { useCallback, useSyncExternalStore } from 'react';

function mql(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;
}

/** true quando a media query casa; sem matchMedia (SSR/jsdom) = false. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const m = mql(query);
      if (!m) return () => undefined;
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => mql(query)?.matches ?? false,
    () => false,
  );
}
