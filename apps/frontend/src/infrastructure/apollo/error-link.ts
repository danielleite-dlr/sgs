import { fromPromise, Observable, type FetchResult } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { useAuthStore } from '../stores/auth.store';
import { refreshAccessToken } from './refresh-session';

/** Operações de autenticação não passam pela renovação (evita laço). */
const AUTH_OPERATIONS = new Set(['Login', 'RefreshSession', 'Logout']);

function goToLogin() {
  useAuthStore.getState().clearSession();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
}

/**
 * Apollo Link that handles GraphQL and network errors globally.
 *
 * UNAUTHENTICATED: o access token dura 15 minutos. Antes de derrubar a sessão,
 * renova pelo refresh token (30 dias) e repete a operação. Só vai para o login
 * se a renovação for recusada. Sem rede, mantém a sessão.
 * FORBIDDEN: clears session (security — assume token tampering).
 *
 * Exceção: se o admin está dentro do salão de um cliente, o token de lá vale 15
 * minutos e não renova. Quando ele vence, derrubar a sessão inteira jogaria o
 * admin no login sem motivo — a sessão de plataforma dele continua válida. Nesse
 * caso a gente devolve a sessão guardada e volta para o painel.
 */
export const errorLink = onError(({ graphQLErrors, networkError, operation, forward, response }) => {
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

        const refreshOutcome = operation.getContext().refreshOutcome as
          | 'ok'
          | 'invalid'
          | 'network'
          | undefined;

        // Operação já repetida depois da renovação e ainda recusada: nunca renova de novo.
        if (code === 'UNAUTHENTICATED' && refreshOutcome) {
          // Sem rede na renovação: mantém a sessão para tentar depois.
          if (refreshOutcome === 'network') return;
          goToLogin();
          return;
        }

        const canRefresh =
          code === 'UNAUTHENTICATED' &&
          !!state.refreshToken &&
          !AUTH_OPERATIONS.has(operation.operationName);

        if (canRefresh) {
          return fromPromise(refreshAccessToken()).flatMap((outcome) => {
            if (outcome === 'invalid') {
              goToLogin();
              // Não repete: sairia sem token à toa.
              return Observable.of(
                (response ?? { errors: graphQLErrors }) as FetchResult,
              );
            }
            operation.setContext({ refreshOutcome: outcome });
            // O resultado da repetição não volta a passar por este handler: confere aqui.
            return forward(operation).map((retry) => {
              const stillDenied = retry.errors?.some(
                (e) => e.extensions?.code === 'UNAUTHENTICATED',
              );
              if (stillDenied && outcome === 'ok') goToLogin();
              return retry;
            });
          });
        }

        goToLogin();
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
