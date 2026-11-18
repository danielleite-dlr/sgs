import * as webpush from 'web-push';
import {
  NoopWebPushProvider,
  WebPushProvider,
  createWebPushProvider,
  WEBPUSH_TTL_SECONDS,
} from './web-push.provider';

const pair = webpush.generateVAPIDKeys();
const VAPID = {
  publicKey: pair.publicKey,
  privateKey: pair.privateKey,
  subject: 'https://sgs.jessicaseixasmakeup.com.br',
};
const MSG = { title: 'T', body: 'B', data: { route: '/agenda' } };
const KEYS = { p256dh: 'B' + 'a'.repeat(86), auth: 'c'.repeat(22) };
const EP = 'https://web.push.apple.com/abc';

const httpErr = (statusCode?: number, msg = 'x') => Object.assign(new Error(msg), { statusCode });

function build(err?: unknown) {
  const sendNotification = jest.fn(async () => {
    if (err) throw err;
    return {} as never;
  });
  return {
    sendNotification,
    provider: new WebPushProvider(VAPID, { sendNotification }),
  };
}

describe('WebPushProvider', () => {
  it('envia com chaves, payload JSON e opções VAPID por chamada', async () => {
    const { provider, sendNotification } = build();
    expect(await provider.send(EP, MSG, KEYS)).toEqual({ status: 'sent' });
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: EP, keys: KEYS },
      JSON.stringify(MSG),
      { vapidDetails: VAPID, TTL: 43200, urgency: 'high', timeout: 10000 },
    );
    expect(WEBPUSH_TTL_SECONDS).toBe(43200);
  });

  it('sem chaves é inválido e não chama a lib', async () => {
    const { provider, sendNotification } = build();
    expect(await provider.send(EP, MSG)).toEqual({
      status: 'invalid_token',
      reason: 'inscrição sem chaves',
    });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it.each([404, 410])('%i vira invalid_token', async (code) => {
    const { provider } = build(httpErr(code));
    expect(await provider.send(EP, MSG, KEYS)).toEqual({
      status: 'invalid_token',
      reason: `WebPush ${code}`,
    });
  });

  it.each([401, 403])('%i é falha de credencial sem retry', async (code) => {
    const { provider } = build(httpErr(code));
    const r = await provider.send(EP, MSG, KEYS);
    expect(r).toMatchObject({ status: 'failed', retryable: false });
    expect((r as { reason: string }).reason).toMatch(/credencial/);
  });

  it.each([400, 413])('%i falha sem retry', async (code) => {
    const { provider } = build(httpErr(code));
    expect(await provider.send(EP, MSG, KEYS)).toMatchObject({
      status: 'failed',
      retryable: false,
    });
  });

  it.each([429, 500, 503])('%i é retentável', async (code) => {
    const { provider } = build(httpErr(code));
    expect(await provider.send(EP, MSG, KEYS)).toMatchObject({
      status: 'failed',
      retryable: true,
    });
  });

  it('erro de rede sem statusCode (ECONNREFUSED) é retentável', async () => {
    const { provider } = build(httpErr(undefined, 'connect ECONNREFUSED'));
    expect(await provider.send(EP, MSG, KEYS)).toMatchObject({
      status: 'failed',
      retryable: true,
    });
  });

  it('nenhuma reason contém a chave privada', async () => {
    for (const code of [401, 410, 400, 500, undefined]) {
      const { provider } = build(httpErr(code));
      const r = await provider.send(EP, MSG, KEYS);
      expect(JSON.stringify(r)).not.toContain(VAPID.privateKey);
    }
  });

  it('Noop e factory', () => {
    expect(new NoopWebPushProvider().enabled).toBe(false);
    expect(createWebPushProvider(null)).toBeInstanceOf(NoopWebPushProvider);
    const p = createWebPushProvider(VAPID);
    expect(p).toBeInstanceOf(WebPushProvider);
    expect(p.enabled).toBe(true);
  });
});
