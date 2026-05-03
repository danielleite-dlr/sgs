import { onError } from '@apollo/client/link/error';
import { useAuthStore } from '../stores/auth.store';

/**
 * Apollo Link that handles GraphQL and network errors globally.
 * On UNAUTHENTICATED error: clears the auth session and redirects to /login.
 * On FORBIDDEN: clears session (security — assume token tampering).
 */
export const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const code = err.extensions?.code as string | undefined;

      if (code === 'UNAUTHENTICATED' || code === 'FORBIDDEN') {
        useAuthStore.getState().clearSession();
        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login')
        ) {
          window.location.assign('/login');
        }
        return;
      }

      if (import.meta.env.DEV) {
        console.error(`[apollo] GraphQL error ${code ?? 'UNKNOWN'}: ${err.message}`);
      }
    }
  }

  if (networkError) {
    // Sentry capture will be wired in QA phase. Console for now.
    console.error('[apollo] networkError', networkError);
  }
});
