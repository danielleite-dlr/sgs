import { gql } from '@apollo/client';
import { apolloClient } from '@/infrastructure/apollo/client';

// Mesmo texto de packages/shared/src/graphql/push-config.ts.
export const PUSH_CONFIG = gql`
  query PushConfig {
    pushConfig {
      webPushPublicKey
    }
  }
`;

export async function fetchWebPushPublicKey(): Promise<string | null> {
  try {
    const res = await apolloClient.query<{ pushConfig: { webPushPublicKey: string | null } }>({
      query: PUSH_CONFIG,
      fetchPolicy: 'network-only',
    });
    return res.data?.pushConfig?.webPushPublicKey ?? null;
  } catch {
    return null;
  }
}
