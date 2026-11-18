export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export const PUSH_PROVIDERS = ['fcm', 'expo', 'webpush'] as const; // 'expo' reservado (Expo Push Service), não usado nesta fase
export const MAX_DEVICE_TOKEN_LENGTH = 4096;
const MAX_APP_VERSION_LENGTH = 20;
// Único lugar da lista. Estender (ex.: fcm.googleapis.com) só se houver Web Push fora do iPhone.
export const WEBPUSH_ALLOWED_HOSTS = ['web.push.apple.com'];
const MAX_WEBPUSH_ENDPOINT_LENGTH = 2048;
const P256DH_RE = /^[A-Za-z0-9_-]{87}=?$/;
const AUTH_RE = /^[A-Za-z0-9_-]{22}(==)?$/;

function isValidWebPushEndpoint(token: string): boolean {
  if (token.length > MAX_WEBPUSH_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(token);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    WEBPUSH_ALLOWED_HOSTS.includes(url.hostname.toLowerCase())
  );
}

export type DeviceTokenInputError = {
  field: 'token' | 'platform' | 'provider' | 'appVersion' | 'p256dh' | 'auth';
  message: string;
};

export function validateDeviceTokenInput(input: {
  token: string;
  platform: string;
  provider?: string | null;
  appVersion?: string | null;
  p256dh?: string | null;
  auth?: string | null;
}): DeviceTokenInputError | null {
  if (input.token.trim().length === 0 || input.token.length > MAX_DEVICE_TOKEN_LENGTH) {
    return { field: 'token', message: 'Token do aparelho inválido.' };
  }
  if (!(DEVICE_PLATFORMS as readonly string[]).includes(input.platform)) {
    return { field: 'platform', message: 'Plataforma inválida.' };
  }
  if (!(PUSH_PROVIDERS as readonly string[]).includes(input.provider ?? 'fcm')) {
    return { field: 'provider', message: 'Provedor de push inválido.' };
  }
  if (input.appVersion != null && input.appVersion.length > MAX_APP_VERSION_LENGTH) {
    return { field: 'appVersion', message: 'Versão do app inválida.' };
  }
  if ((input.provider ?? 'fcm') === 'webpush') {
    if (input.platform !== 'ios') {
      return { field: 'platform', message: 'Plataforma inválida.' };
    }
    if (!isValidWebPushEndpoint(input.token)) {
      return { field: 'token', message: 'Inscrição de notificação inválida.' };
    }
    if (!P256DH_RE.test(input.p256dh ?? '')) {
      return { field: 'p256dh', message: 'Chaves da inscrição inválidas.' };
    }
    if (!AUTH_RE.test(input.auth ?? '')) {
      return { field: 'auth', message: 'Chaves da inscrição inválidas.' };
    }
  }
  return null;
}
