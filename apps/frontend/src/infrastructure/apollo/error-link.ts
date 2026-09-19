import { onError } from '@apollo/client/link/error';
import { useAuthStore } from '../stores/auth.store';

/**
 * Apollo Link that handles GraphQL and network errors globally.
 * On UNAUTHENTICATED error: clears the auth session and redirects to /login.
 * On FORBIDDEN: clears session (security — assume token tampering).
 *
 * Exceção: se o admin está dentro do salão de um cliente, o token de lá vale 15
 * minutos e não renova. Quando ele vence, derrubar a sessão inteira jogaria o
 * admin no login sem motivo — a sessão de plataforma dele continua válida. Nesse
 * caso a gente devolve a sessão guardada e volta para o painel.
 */
export const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const code = err.extensions?.code as string | undefined;

      if (code === 'UNAUTHENTICATED' || code === 'FORBIDDEN') {
        const state = useAuthStore.getState();

        if (state.impersonating && state.platformSession?.accessToken) {
          state.takePlatformStash();
          if (typeof window !== 'undefined') {
            window.location.assign('/admin');
          }
          return;
        }

        state.clearSession();
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
