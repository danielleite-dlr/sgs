import { useEffect, useRef } from 'react';
import { router } from '@/router';
import { selectIsAuthenticated, useAuthStore } from '@/infrastructure/stores/auth.store';
import { isAllowedPushRoute, savePendingRoute } from '@/infrastructure/native/push-route';
import { isWebPushContext, supportsWebPush } from './platform-ios';
import { registerServiceWorker, syncWebPushSubscription } from './web-push-client';

/**
 * Ponte entre o service worker do app instalado no iPhone e a interface. Não renderiza nada e é
 * inerte no navegador comum e no app Android (Capacitor).
 */
export function WebPushBridge() {
  const memberId = useAuthStore((s) => s.memberId);
  const organizationId = useAuthStore((s) => s.organizationId);
  const impersonating = useAuthStore((s) => s.impersonating);
  const isAuth = useAuthStore(selectIsAuthenticated);
  const syncedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isWebPushContext() || !supportsWebPush()) return;

    void registerServiceWorker().catch((e) =>
      console.warn('Falha ao registrar o service worker', e),
    );

    const onMessage = (event: MessageEvent) => {
      const d = event.data as { type?: unknown; route?: unknown } | null;
      if (!d || d.type !== 'sgs-open-route' || !isAllowedPushRoute(d.route)) return;
      if (selectIsAuthenticated(useAuthStore.getState())) {
        void router.navigate(d.route);
      } else {
        savePendingRoute(d.route);
        void router.navigate('/login');
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!isWebPushContext() || !supportsWebPush()) return;
    if (isAuth && memberId && organizationId && !impersonating) {
      const key = `${memberId}:${organizationId}`;
      if (syncedKey.current === key) return;
      syncedKey.current = key;
      void syncWebPushSubscription().catch((e) =>
        console.warn('Falha ao sincronizar as notificações', e),
      );
    } else {
      syncedKey.current = null;
    }
  }, [isAuth, memberId, organizationId, impersonating]);

  return null;
}
