import { isNativeApp } from '@/infrastructure/native/platform';

const THIRD_PARTY_RE = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//;

type IosNavigator = Navigator & { standalone?: boolean };

export function isIosDevice(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent ?? '';
  if (/iPhone|iPod|iPad/.test(ua)) return true;
  // iPadOS 13+ se apresenta como Mac, mas tem toque.
  return /Macintosh/.test(ua) && nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
}

export function isStandalone(nav: Navigator = navigator, win: Window = window): boolean {
  if ((nav as IosNavigator).standalone === true) return true;
  if (typeof win.matchMedia !== 'function') return false;
  return win.matchMedia('(display-mode: standalone)').matches;
}

export function isIosSafari(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent ?? '';
  if (!isIosDevice(nav)) return false;
  if (THIRD_PARTY_RE.test(ua)) return false;
  return /Safari\//.test(ua);
}

export function supportsWebPush(nav: Navigator = navigator, win: Window = window): boolean {
  return 'serviceWorker' in nav && 'PushManager' in win && 'Notification' in win;
}

export function isWebPushContext(nav: Navigator = navigator, win: Window = window): boolean {
  return !isNativeApp() && isStandalone(nav, win);
}
