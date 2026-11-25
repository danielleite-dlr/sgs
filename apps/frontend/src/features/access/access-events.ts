/** Evento global: o acesso da pessoa pode ter mudado, vale reler myAccess (fase 10, D-13). */
export const ACCESS_CHANGED_EVENT = 'sgs:access-changed';

export function notifyAccessChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ACCESS_CHANGED_EVENT));
}
