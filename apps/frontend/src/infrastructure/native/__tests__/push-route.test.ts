import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumePendingRoute,
  isAllowedPushRoute,
  PENDING_ROUTE_KEY,
  savePendingRoute,
} from '../push-route';

describe('push-route', () => {
  beforeEach(() => sessionStorage.clear());

  it('aceita rotas da agenda', () => {
    expect(isAllowedPushRoute('/agenda')).toBe(true);
    expect(isAllowedPushRoute('/agenda?data=2026-11-20&visao=day&agendamento=x')).toBe(true);
  });

  it.each([
    'https://evil.com/agenda',
    '//evil.com',
    '/agenda/../admin',
    '/comanda/1',
    'javascript:alert(1)',
    42,
    undefined,
  ])('recusa %s', (route) => {
    expect(isAllowedPushRoute(route)).toBe(false);
  });

  it('grava e consome a rota pendente uma única vez', () => {
    savePendingRoute('/agenda?data=2026-11-20&visao=day');
    expect(sessionStorage.getItem(PENDING_ROUTE_KEY)).toBe('/agenda?data=2026-11-20&visao=day');
    expect(consumePendingRoute()).toBe('/agenda?data=2026-11-20&visao=day');
    expect(consumePendingRoute()).toBeNull();
  });

  it('não grava rota fora da allowlist', () => {
    savePendingRoute('/admin');
    expect(sessionStorage.getItem(PENDING_ROUTE_KEY)).toBeNull();
  });

  it('descarta valor adulterado no storage', () => {
    sessionStorage.setItem(PENDING_ROUTE_KEY, '/admin');
    expect(consumePendingRoute()).toBeNull();
  });
});
