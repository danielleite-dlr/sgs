import * as webpush from 'web-push';
import type { VapidDetails } from './web-push-credentials';
import type { PushMessage, PushProvider, PushSendResult, WebPushKeys } from './push.types';

type Sender = typeof webpush.sendNotification;

export const WEBPUSH_TTL_SECONDS = 12 * 3600;
const WEBPUSH_TIMEOUT_MS = 10000;

export class NoopWebPushProvider implements PushProvider {
  readonly enabled = false;
  async send(): Promise<PushSendResult> {
    return {
      status: 'failed',
      retryable: false,
      reason: 'web push desabilitado',
    };
  }
}

export class WebPushProvider implements PushProvider {
  readonly enabled = true;
  private readonly sender: Sender;

  constructor(
    private readonly vapid: VapidDetails,
    deps: { sendNotification?: Sender } = {},
  ) {
    this.sender = deps.sendNotification ?? webpush.sendNotification;
  }

  async send(endpoint: string, message: PushMessage, keys?: WebPushKeys): Promise<PushSendResult> {
    if (!keys) return { status: 'invalid_token', reason: 'inscrição sem chaves' };
    try {
      await this.sender(
        { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
        JSON.stringify({
          title: message.title,
          body: message.body,
          data: message.data,
        }),
        {
          vapidDetails: {
            subject: this.vapid.subject,
            publicKey: this.vapid.publicKey,
            privateKey: this.vapid.privateKey,
          },
          TTL: WEBPUSH_TTL_SECONDS,
          urgency: 'high',
          timeout: WEBPUSH_TIMEOUT_MS,
        },
      );
      return { status: 'sent' };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        return { status: 'invalid_token', reason: `WebPush ${status}` };
      }
      if (status === 401 || status === 403) {
        return {
          status: 'failed',
          retryable: false,
          reason: `erro de credencial VAPID (${status})`,
        };
      }
      const reason = `WebPush ${status ?? 'rede'}: ${(e as Error).message}`;
      if (status === 400 || status === 413) return { status: 'failed', retryable: false, reason };
      return { status: 'failed', retryable: true, reason };
    }
  }
}

export function createWebPushProvider(vapid: VapidDetails | null): PushProvider {
  return vapid ? new WebPushProvider(vapid) : new NoopWebPushProvider();
}
