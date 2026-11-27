import { parseFcmServiceAccount } from './fcm-credentials';
import {
  ANDROID_CHANNEL_ID,
  ANDROID_NOTIFICATION_COLOR,
  ANDROID_NOTIFICATION_ICON,
  createPushProvider,
  FcmPushProvider,
  NoopPushProvider,
} from './fcm-push.provider';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64');
const creds = { projectId: 'gestor-beauty', clientEmail: 'x@y', privateKey: 'KEY' };
const msg = { title: 'T', body: 'B', data: { kind: 'appointment.created', route: '/agenda' } };

describe('parseFcmServiceAccount', () => {
  it('vazio devolve null', () => {
    expect(parseFcmServiceAccount(undefined)).toBeNull();
    expect(parseFcmServiceAccount('')).toBeNull();
  });

  it('sem private_key devolve null', () => {
    expect(parseFcmServiceAccount(b64({ project_id: 'p', client_email: 'e' }))).toBeNull();
  });

  it('JSON válido em base64', () => {
    const pk = '-----BEGIN PRIVATE KEY-----\nabc\n';
    expect(
      parseFcmServiceAccount(
        b64({ project_id: 'gestor-beauty', client_email: 'x@y', private_key: pk }),
      ),
    ).toEqual({ projectId: 'gestor-beauty', clientEmail: 'x@y', privateKey: pk });
  });

  it('lixo não lança', () => {
    expect(parseFcmServiceAccount('isto não é base64 {{{')).toBeNull();
  });
});

function makeProvider(res: { status: number; body?: unknown } | Error) {
  const fetchMock = jest.fn(async () => {
    if (res instanceof Error) throw res;
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      json: async () => res.body ?? {},
    } as unknown as Response;
  });
  const provider = new FcmPushProvider(creds, {
    fetch: fetchMock as unknown as typeof fetch,
    getAccessToken: async () => 'tok-123',
  });
  return { provider, fetchMock };
}

describe('FcmPushProvider', () => {
  it('monta a requisição FCM v1', async () => {
    const { provider, fetchMock } = makeProvider({ status: 200 });
    const r = await provider.send('device-token', {
      ...msg,
      data: { kind: 'k', n: 5 as unknown as string },
    });
    expect(r).toEqual({ status: 'sent' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://fcm.googleapis.com/v1/projects/gestor-beauty/messages:send');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect(JSON.parse(init.body as string)).toEqual({
      message: {
        token: 'device-token',
        notification: { title: 'T', body: 'B' },
        data: { kind: 'k', n: '5' },
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: ANDROID_CHANNEL_ID,
            icon: ANDROID_NOTIFICATION_ICON,
            color: ANDROID_NOTIFICATION_COLOR,
          },
        },
      },
    });
    expect(ANDROID_CHANNEL_ID).toBe('agenda');
    expect(ANDROID_NOTIFICATION_ICON).toBe('ic_stat_gestor_beauty');
    expect(ANDROID_NOTIFICATION_COLOR).toBe('#7E22CE');
  });

  it('404 vira invalid_token', async () => {
    const { provider } = makeProvider({ status: 404, body: { error: { status: 'NOT_FOUND' } } });
    expect((await provider.send('t', msg)).status).toBe('invalid_token');
  });

  it('400 com UNREGISTERED vira invalid_token', async () => {
    const { provider } = makeProvider({
      status: 400,
      body: { error: { status: 'INVALID_ARGUMENT', details: [{ errorCode: 'UNREGISTERED' }] } },
    });
    expect((await provider.send('t', msg)).status).toBe('invalid_token');
  });

  it('403 SENDER_ID_MISMATCH vira invalid_token', async () => {
    const { provider } = makeProvider({
      status: 403,
      body: { error: { status: 'PERMISSION_DENIED', details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } },
    });
    expect((await provider.send('t', msg)).status).toBe('invalid_token');
  });

  it('400 INVALID_ARGUMENT sem UNREGISTERED não é re-tentável', async () => {
    const { provider } = makeProvider({
      status: 400,
      body: { error: { status: 'INVALID_ARGUMENT', message: 'bad' } },
    });
    expect(await provider.send('t', msg)).toMatchObject({ status: 'failed', retryable: false });
  });

  it.each([401, 403])('%i sem SENDER_ID_MISMATCH é erro de credencial', async (code) => {
    const { provider } = makeProvider({ status: code, body: { error: { status: 'X' } } });
    const r = await provider.send('t', msg);
    expect(r).toMatchObject({ status: 'failed', retryable: false });
    expect((r as { reason: string }).reason).toContain('credencial');
  });

  it.each([429, 500, 503])('%i é re-tentável', async (code) => {
    const { provider } = makeProvider({ status: code, body: {} });
    expect(await provider.send('t', msg)).toMatchObject({ status: 'failed', retryable: true });
  });

  it('erro de rede é re-tentável', async () => {
    const { provider } = makeProvider(new Error('ECONNRESET'));
    expect(await provider.send('t', msg)).toMatchObject({ status: 'failed', retryable: true });
  });

  it('reason não vaza o token do aparelho', async () => {
    const { provider } = makeProvider({ status: 500, body: {} });
    const r = await provider.send('SEGREDO-DO-APARELHO', msg);
    expect(JSON.stringify(r)).not.toContain('SEGREDO-DO-APARELHO');
  });
});

describe('createPushProvider / Noop', () => {
  it('sem credencial é no-op', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const p = createPushProvider(null);
    expect(p.enabled).toBe(false);
    expect(p).toBeInstanceOf(NoopPushProvider);
    expect(await p.send('t', msg)).toEqual({
      status: 'failed',
      retryable: false,
      reason: 'push desabilitado',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('com credencial é FCM', () => {
    expect(createPushProvider(creds).enabled).toBe(true);
  });
});
