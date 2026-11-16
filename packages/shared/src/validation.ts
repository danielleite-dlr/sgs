export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export const PUSH_PROVIDERS = ['fcm', 'expo'] as const; // 'expo' reservado (Expo Push Service), não usado nesta fase
export const MAX_DEVICE_TOKEN_LENGTH = 4096;
const MAX_APP_VERSION_LENGTH = 20;

export type DeviceTokenInputError = {
  field: 'token' | 'platform' | 'provider' | 'appVersion';
  message: string;
};

export function validateDeviceTokenInput(input: {
  token: string;
  platform: string;
  provider?: string | null;
  appVersion?: string | null;
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
  return null;
}
