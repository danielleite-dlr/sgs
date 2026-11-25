import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { ACCESS_CHANGED_EVENT } from './access-events';
import { MyAccessQuery, type MyAccessResult } from './access.api';

/** Intervalo mínimo entre leituras disparadas por troca de rota. */
const ROUTE_REFETCH_LOCK_MS = 10_000;

/** Montado UMA vez no AppShell. Mantém o acesso da pessoa em dia (D-13). */
export function useMyAccessSync(): void {
  const setAccess = useAuthStore((s) => s.setAccess);
  const { pathname } = useLocation();
  const lastRouteRefetch = useRef(Date.now());

  const { data, refetch } = useQuery<MyAccessResult>(MyAccessQuery, {
    pollInterval: 60_000,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    // Erros ficam com o error-link (ACCESS_DENIED não derruba a sessão).
    errorPolicy: 'ignore',
  });

  useEffect(() => {
    if (data?.myAccess) setAccess(data.myAccess);
  }, [data, setAccess]);

  const reload = useCallback(() => {
    void refetch().catch(() => {});
  }, [refetch]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener(ACCESS_CHANGED_EVENT, reload);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(ACCESS_CHANGED_EVENT, reload);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  const firstPath = useRef(pathname);
  useEffect(() => {
    if (firstPath.current === pathname) return;
    firstPath.current = pathname;
    const now = Date.now();
    if (now - lastRouteRefetch.current < ROUTE_REFETCH_LOCK_MS) return;
    lastRouteRefetch.current = now;
    reload();
  }, [pathname, reload]);
}
