import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/auth.store';
import { refreshAccessToken } from '../refresh-session';

const ok = (body: unknown, status = 200) =>
  ({ status, json: async () => body }) as unknown as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  useAuthStore.setState({ accessToken: 'old', refreshToken: 'r1' });
});

describe('refreshAccessToken', () => {
  it('duas chamadas simultâneas fazem um único fetch', async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    const a = refreshAccessToken();
    const b = refreshAccessToken();
    resolve(
      ok({ data: { refreshSession: { accessToken: 'a2', refreshToken: 'r2', errors: [] } } }),
    );
    expect(await a).toBe('ok');
    expect(await b).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('grava os tokens novos e envia o refresh token atual', async () => {
    fetchMock.mockResolvedValue(
      ok({ data: { refreshSession: { accessToken: 'a2', refreshToken: 'r2', errors: [] } } }),
    );
    expect(await refreshAccessToken()).toBe('ok');
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('a2');
    expect(s.refreshToken).toBe('r2');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.operationName).toBe('RefreshSession');
    expect(body.variables.input.refreshToken).toBe('r1');
  });

  it('refresh recusado devolve invalid e não mexe no store', async () => {
    fetchMock.mockResolvedValue(
      ok({
        data: {
          refreshSession: { accessToken: null, refreshToken: null, errors: [{ code: 'TOKEN_INVALID' }] },
        },
      }),
    );
    expect(await refreshAccessToken()).toBe('invalid');
    expect(useAuthStore.getState().accessToken).toBe('old');
    expect(useAuthStore.getState().refreshToken).toBe('r1');
  });

  it('erro de rede, 503 e 429 viram network', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fail'));
    expect(await refreshAccessToken()).toBe('network');
    fetchMock.mockResolvedValueOnce(ok({}, 503));
    expect(await refreshAccessToken()).toBe('network');
    fetchMock.mockResolvedValueOnce(ok({}, 429));
    expect(await refreshAccessToken()).toBe('network');
  });

  it('sem refresh token devolve invalid sem chamar fetch', async () => {
    useAuthStore.setState({ refreshToken: null });
    expect(await refreshAccessToken()).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('depois de resolvida, nova chamada faz novo fetch', async () => {
    fetchMock.mockResolvedValue(ok({}, 503));
    await refreshAccessToken();
    await refreshAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
