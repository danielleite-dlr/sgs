import { onError } from '@apollo/client/link/error';
import { useAuthStore } from '../stores/auth.store';

/**
 * Apollo Link that handles GraphQL and network errors globally.
 * On UNAUTHENTICATED error: clears the auth session so the app
 * redirects to login (handled by router guards).
 */
export const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    for (const { message, extensions } of graphQLErrors) {
      const code = extensions?.code as string | undefined;

      if (code === 'UNAUTHENTICATED') {
        // Token expired or invalid — clear session to trigger auth redirect
        useAuthStore.getState().clearSession();
        return;
      }

      if (import.meta.env.DEV) {
        console.error(`[GraphQL Error] ${code}: ${message}`);
      }
    }
  }

  if (networkError) {
    if (import.meta.env.DEV) {
      console.error(`[Network Error] ${networkError.message}`);
    }
  }
});
