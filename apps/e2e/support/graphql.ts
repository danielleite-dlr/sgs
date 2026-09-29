export const API_URL = 'http://localhost:3100/graphql';

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

export async function gql<T = any>(
  query: string,
  variables: Record<string, unknown> = {},
  opts: { token?: string; orgId?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.orgId) headers['X-Organization-Id'] = opts.orgId;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: T; errors?: unknown[] };
  if (body.errors?.length || !body.data) {
    throw new Error(`GraphQL error: ${JSON.stringify(body)}`);
  }
  return body.data;
}

/** Falha alto quando o payload (erro-como-dado) traz `errors` não vazio. */
export function expectNoUserErrors(
  payload: { errors?: UserError[] } | null | undefined,
  what = 'operação',
): void {
  if (!payload) throw new Error(`${what}: payload vazio`);
  if (payload.errors?.length) {
    throw new Error(`${what} falhou: ${JSON.stringify(payload.errors)}`);
  }
}
