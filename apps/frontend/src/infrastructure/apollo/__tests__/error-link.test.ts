import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApolloLink, Observable, execute, from, gql, type FetchResult } from '@apollo/client';
import { useAuthStore } from '../../stores/auth.store';

vi.mock('../refresh-session', () => ({ refreshAccessToken: vi.fn() }));

import { refreshAccessToken } from '../refresh-session';
import { errorLink } from '../error-link';
import { authLink } from '../auth-link';

const refreshMock = vi.mocked(refreshAccessToken);
const unauth = { errors: [{ message: 'x', extensions: { code: 'UNAUTHENTICATED' } }] };
const assign = vi.fn();

function run(responses: unknown[], opName = 'Agenda') {
  const auths: (string | undefined)[] = [];
  let i = 0;
  const terminal = new ApolloLink((op) => {
    auths.push(op.getContext().headers?.Authorization);
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Observable<FetchResult>((o) => {
      o.next(r as FetchResult);
      o.complete();
    });
  });
  const link = from([errorLink, authLink, terminal]);
  const query = gql(`query ${opName} { ok }`);
  const result = new Promise<FetchResult>((resolve, reject) => {
    execute(link, { query }).subscribe({ next: resolve, error: reject });
  });
  return { result, auths };
}

beforeEach(() => {
  refreshMock.mockReset();
  assign.mockReset();
  vi.stubGlobal('location', { pathname: '/agenda', assign });
  useAuthStore.setState({
    accessToken: 'velho',
    refreshToken: 'r1',
    impersonating: false,
    platformSession: null,
  } as never);
});

describe('errorLink', () => {
  it('renova e repete com o token novo', async () => {
    refreshMock.mockImplementation(async () => {
      useAuthStore.setState({ accessToken: 'novo' });
      return 'ok';
    });
    const { result, auths } = run([unauth, { data: { ok: true } }]);
    expect(await result).toEqual({ data: { ok: true } });
    expect(auths).toEqual(['Bearer velho', 'Bearer novo']);
    expect(useAuthStore.getState().accessToken).toBe('novo');
    expect(assign).not.toHaveBeenCalled();
  });

  it('refresh invalid limpa a sessão, vai ao login e não repete', async () => {
    refreshMock.mockResolvedValue('invalid');
    const { result, auths } = run([unauth, { data: { ok: true } }]);
    await result;
    expect(auths).toHaveLength(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('refresh network repete uma vez e mantém a sessão', async () => {
    refreshMock.mockResolvedValue('network');
    const { result, auths } = run([unauth, unauth]);
    await result;
    expect(auths).toHaveLength(2);
    expect(useAuthStore.getState().refreshToken).toBe('r1');
    expect(assign).not.toHaveBeenCalled();
  });

  it('refresh ok mas repetição recusada: renova uma vez só e vai ao login', async () => {
    refreshMock.mockResolvedValue('ok');
    const { result, auths } = run([unauth, unauth]);
    await result;
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(auths).toHaveLength(2);
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('operação Login não renova', async () => {
    const { result } = run([unauth], 'Login');
    await result;
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('impersonação devolve a sessão guardada e vai ao admin, sem renovar', async () => {
    const takePlatformStash = vi.fn();
    useAuthStore.setState({
      impersonating: true,
      platformSession: { accessToken: 'plat' },
      takePlatformStash,
    } as never);
    const { result } = run([unauth]);
    await result;
    expect(takePlatformStash).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/admin');
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
