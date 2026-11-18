// Cópia de packages/shared/src/push.ts — o Docker do frontend não enxerga o workspace.
export const AGENDA_ROUTE_RE = /^\/agenda(\?[A-Za-z0-9=&._~%-]*)?$/;
export const PUSH_ROUTE_RE = /^\/(agenda|comercial\/lembretes)(\?[A-Za-z0-9=&._~%-]*)?$/;

export function isAllowedPushRoute(route: unknown): route is string {
  return (
    typeof route === 'string' &&
    route.length <= 300 &&
    !route.includes('..') &&
    !route.startsWith('//') &&
    PUSH_ROUTE_RE.test(route)
  );
}

export const PENDING_ROUTE_KEY = 'sgs-pending-route';

export function savePendingRoute(route: unknown): void {
  if (!isAllowedPushRoute(route)) return;
  try {
    sessionStorage.setItem(PENDING_ROUTE_KEY, route);
  } catch {
    // sem storage: ignora
  }
}

export function consumePendingRoute(): string | null {
  try {
    const value = sessionStorage.getItem(PENDING_ROUTE_KEY);
    sessionStorage.removeItem(PENDING_ROUTE_KEY);
    return isAllowedPushRoute(value) ? value : null;
  } catch {
    return null;
  }
}
