import { gql } from '@apollo/client';
import { apolloClient } from '@/infrastructure/apollo/client';

export const DEVICE_TOKEN_KEY = 'sgs-device-token';

// Mesmo texto de packages/shared/src/graphql/device-tokens.ts.
export const REGISTER_DEVICE_TOKEN = gql`
  mutation RegisterDeviceToken($input: RegisterDeviceTokenInput!) {
    registerDeviceToken(input: $input)
  }
`;

export const UNREGISTER_DEVICE_TOKEN = gql`
  mutation UnregisterDeviceToken($token: String!) {
    unregisterDeviceToken(token: $token)
  }
`;

export async function registerDeviceToken(token: string): Promise<void> {
  await apolloClient.mutate({
    mutation: REGISTER_DEVICE_TOKEN,
    variables: { input: { token, platform: 'android', provider: 'fcm' } },
  });
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
}

export async function unregisterCurrentDeviceToken(): Promise<void> {
  const token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) return;
  try {
    await apolloClient.mutate({ mutation: UNREGISTER_DEVICE_TOKEN, variables: { token } });
  } finally {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  }
}
