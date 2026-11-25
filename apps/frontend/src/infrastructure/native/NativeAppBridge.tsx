import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { router } from '@/router';
import { selectIsAuthenticated, useAuthStore } from '@/infrastructure/stores/auth.store';
import { notifyAccessChanged } from '@/features/access/access-events';
import { registerDeviceToken } from './device-token.api';
import { addPushListeners, registerForPush } from './native-push';
import { OfflineOverlay } from './OfflineOverlay';
import { isNativeApp } from './platform';
import { savePendingRoute } from './push-route';

/**
 * Ponte entre o app Android (Capacitor) e a interface web. Não renderiza nada e é inerte no
 * navegador.
 *
 * O plugin de push retém o toque que abriu o app a frio até o primeiro listener existir
 * (RESEARCH Pattern 4), por isso os listeners entram na montagem, antes do login.
 */
export function NativeAppBridge() {
  const memberId = useAuthStore((s) => s.memberId);
  const organizationId = useAuthStore((s) => s.organizationId);
  const impersonating = useAuthStore((s) => s.impersonating);
  const isAuth = useAuthStore(selectIsAuthenticated);
  const registeredKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    let removePush: (() => void) | undefined;
    let backHandle: { remove: () => Promise<void> } | undefined;
    let stateHandle: { remove: () => Promise<void> } | undefined;

    void (async () => {
      const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([
        import('@capacitor/splash-screen'),
        import('@capacitor/status-bar'),
        import('@capacitor/app'),
      ]);
      if (cancelled) return;

      void SplashScreen.hide({ fadeOutDuration: 200 });
      // Style.Light = ícones escuros, para o cabeçalho claro.
      void StatusBar.setStyle({ style: Style.Light }).catch(() => {});

      const back = await App.addListener('backButton', ({ canGoBack }) => {
        if (document.querySelector('[role="dialog"]')) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return;
        }
        if (canGoBack) window.history.back();
        else void App.exitApp();
      });
      if (cancelled) {
        void back.remove();
        return;
      }
      backHandle = back;

      // Volta do segundo plano: relê os acessos (fase 10, D-13).
      const state = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) notifyAccessChanged();
      });
      if (cancelled) {
        void state.remove();
        return;
      }
      stateHandle = state;

      const remove = await addPushListeners({
        onToken: (token) => {
          registerDeviceToken(token).catch((e) =>
            console.warn('Falha ao registrar o aparelho para notificações', e),
          );
        },
        onOpenRoute: (route) => {
          if (selectIsAuthenticated(useAuthStore.getState())) {
            void router.navigate(route);
          } else {
            savePendingRoute(route);
            void router.navigate('/login');
          }
        },
        onForeground: (title, body) => {
          toast(title || 'Gestor Beauty', { description: body });
        },
      });
      if (cancelled) remove();
      else removePush = remove;
    })();

    return () => {
      cancelled = true;
      removePush?.();
      void backHandle?.remove();
      void stateHandle?.remove();
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    if (isAuth && memberId && organizationId && !impersonating) {
      const key = `${memberId}:${organizationId}`;
      if (registeredKey.current === key) return;
      registeredKey.current = key;
      void registerForPush().catch((e) => console.warn('Falha ao pedir permissão de push', e));
    } else {
      registeredKey.current = null;
    }
  }, [isAuth, memberId, organizationId, impersonating]);

  return <OfflineOverlay />;
}
