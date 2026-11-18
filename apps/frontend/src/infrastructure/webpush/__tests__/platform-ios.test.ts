import { describe, expect, it, vi } from 'vitest';

vi.mock('@/infrastructure/native/platform', () => ({ isNativeApp: vi.fn(() => false) }));

import { isNativeApp } from '@/infrastructure/native/platform';
import {
  isIosDevice,
  isIosSafari,
  isStandalone,
  isWebPushContext,
  supportsWebPush,
} from '../platform-ios';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const nav = (o: Record<string, unknown>) => o as unknown as Navigator;
const win = (o: Record<string, unknown>) => o as unknown as Window;

describe('platform-ios', () => {
  it('detecta iPhone, iPad e iPad como Mac', () => {
    expect(isIosDevice(nav({ userAgent: IPHONE }))).toBe(true);
    expect(isIosDevice(nav({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4)' }))).toBe(true);
    const mac = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel' };
    expect(isIosDevice(nav({ ...mac, maxTouchPoints: 5 }))).toBe(true);
    expect(isIosDevice(nav({ ...mac, maxTouchPoints: 0 }))).toBe(false);
    expect(isIosDevice(nav({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }))).toBe(false);
    expect(isIosDevice(nav({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }))).toBe(false);
  });

  it('detecta standalone', () => {
    expect(isStandalone(nav({ standalone: true }), win({}))).toBe(true);
    const mm = (matches: boolean) => win({ matchMedia: () => ({ matches }) });
    expect(isStandalone(nav({}), mm(true))).toBe(true);
    expect(isStandalone(nav({}), mm(false))).toBe(false);
    expect(isStandalone(nav({}), win({}))).toBe(false);
  });

  it('só considera Safari puro do iOS', () => {
    expect(isIosSafari(nav({ userAgent: IPHONE }))).toBe(true);
    const outros = ['CriOS/120', 'FxiOS/120', 'EdgiOS/120', 'OPiOS/1', 'GSA/300', 'FBAN/x'];
    outros.push('FBAV/x', 'Instagram 300', 'Line/13');
    for (const t of outros) {
      expect(isIosSafari(nav({ userAgent: `${IPHONE} ${t}` }))).toBe(false);
    }
    expect(isIosSafari(nav({ userAgent: IPHONE.replace(' Safari/604.1', '') }))).toBe(false);
  });

  it('supportsWebPush exige SW, PushManager e Notification', () => {
    const full = win({ PushManager: {}, Notification: {} });
    expect(supportsWebPush(nav({ serviceWorker: {} }), full)).toBe(true);
    expect(supportsWebPush(nav({}), full)).toBe(false);
    expect(supportsWebPush(nav({ serviceWorker: {} }), win({ Notification: {} }))).toBe(false);
    expect(supportsWebPush(nav({ serviceWorker: {} }), win({ PushManager: {} }))).toBe(false);
  });

  it('isWebPushContext: standalone e fora do Capacitor', () => {
    const n = nav({ standalone: true });
    expect(isWebPushContext(n, win({}))).toBe(true);
    vi.mocked(isNativeApp).mockReturnValueOnce(true);
    expect(isWebPushContext(n, win({}))).toBe(false);
    expect(isWebPushContext(nav({}), win({}))).toBe(false);
  });
});
