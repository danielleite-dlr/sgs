import { useAuthStore } from '../stores/auth.store';

/**
 * Renova o access token (15 min) usando o refresh token (30 dias) guardado.
 *
 * Sem isso, qualquer requisição depois de 15 minutos parados derrubava a sessão
 * e mandava para o login — no app, praticamente toda vez que era aberto.
 *
 * - 'ok': tokens novos gravados no store.
 * - 'invalid': refresh recusado (vencido, revogado, reuso) — tem que logar de novo.
 * - 'network': sem resposta do servidor — mantém a sessão para tentar depois.
 */
export type RefreshOutcome = 'ok' | 'invalid' | 'network';

const REFRESH_MUTATION = `
  mutation RefreshSession($input: RefreshInput!) {
    refreshSession(input: $input) {
      accessToken
      refreshToken
      errors { code }
    }
  }
`;

function graphqlUrl(): string {
  const base = import.meta.env.VITE_API_URL as string | undefined;
  return base ? `${base}/graphql` : '/graphql';
}

let inFlight: Promise<RefreshOutcome> | null = null;

async function doRefresh(): Promise<RefreshOutcome> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return 'invalid';

  let body: {
    data?: {
      refreshSession?: {
        accessToken: string | null;
        refreshToken: string | null;
        errors?: { code: string }[];
      } | null;
    };
  };
  try {
    const res = await fetch(graphqlUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        operationName: 'RefreshSession',
        query: REFRESH_MUTATION,
        variables: { input: { refreshToken } },
      }),
    });
    if (res.status >= 500 || res.status === 429) return 'network';
    body = await res.json();
  } catch {
    return 'network';
  }

  const payload = body.data?.refreshSession;
  if (!payload?.accessToken || !payload.refreshToken) return 'invalid';

  // Outra aba/logout pode ter trocado a sessão enquanto a renovação rodava.
  if (useAuthStore.getState().refreshToken !== refreshToken) return 'ok';
  useAuthStore.setState({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
  });
  return 'ok';
}

/**
 * Uma renovação por vez: o backend faz rotação com detecção de reuso, então duas
 * chamadas com o mesmo refresh token revogariam a família inteira.
 */
export function refreshAccessToken(): Promise<RefreshOutcome> {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
