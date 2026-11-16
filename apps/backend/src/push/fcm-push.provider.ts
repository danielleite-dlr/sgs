import { GoogleAuth } from 'google-auth-library';
import { FcmServiceAccount } from './fcm-credentials';
import { PushMessage, PushProvider, PushSendResult } from './push.types';

export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
export const ANDROID_CHANNEL_ID = 'agenda';
export const ANDROID_NOTIFICATION_ICON = 'ic_stat_gestor_beauty';
export const ANDROID_NOTIFICATION_COLOR = '#570080';

export class NoopPushProvider implements PushProvider {
  readonly enabled = false;
  async send(): Promise<PushSendResult> {
    return { status: 'failed', retryable: false, reason: 'push desabilitado' };
  }
}

interface FcmErrorBody {
  error?: { status?: string; message?: string; details?: { errorCode?: string }[] };
}

export class FcmPushProvider implements PushProvider {
  readonly enabled = true;
  private readonly fetchFn: typeof fetch;
  private readonly getAccessToken: () => Promise<string>;

  constructor(
    private readonly creds: FcmServiceAccount,
    deps: { fetch?: typeof fetch; getAccessToken?: () => Promise<string> } = {},
  ) {
    this.fetchFn = deps.fetch ?? fetch;
    if (deps.getAccessToken) {
      this.getAccessToken = deps.getAccessToken;
    } else {
      // Uma instância só: o GoogleAuth faz cache e renovação do token.
      const auth = new GoogleAuth({
        credentials: { client_email: creds.clientEmail, private_key: creds.privateKey },
        scopes: [FCM_SCOPE],
      });
      this.getAccessToken = async () => {
        const client = await auth.getClient();
        const { token } = await client.getAccessToken();
        if (!token) throw new Error('sem access token FCM');
        return token;
      };
    }
  }

  async send(token: string, message: PushMessage): Promise<PushSendResult> {
    let status: number;
    let body: FcmErrorBody = {};
    try {
      const accessToken = await this.getAccessToken();
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(message.data)) data[k] = String(v);
      const res = await this.fetchFn(
        `https://fcm.googleapis.com/v1/projects/${this.creds.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data,
              android: {
                priority: 'HIGH',
                notification: {
                  channel_id: ANDROID_CHANNEL_ID,
                  icon: ANDROID_NOTIFICATION_ICON,
                  color: ANDROID_NOTIFICATION_COLOR,
                },
              },
            },
          }),
        },
      );
      status = res.status;
      if (res.ok) return { status: 'sent' };
      body = (await res.json().catch(() => ({}))) as FcmErrorBody;
    } catch (err) {
      return {
        status: 'failed',
        retryable: true,
        reason: `falha de rede/autenticação: ${(err as Error).message ?? 'erro'}`,
      };
    }

    const fcmStatus = body.error?.status ?? '';
    const codes = (body.error?.details ?? []).map((d) => d.errorCode);
    if (status === 404 || codes.includes('UNREGISTERED') || fcmStatus === 'NOT_FOUND') {
      return { status: 'invalid_token', reason: `FCM ${status} ${fcmStatus}`.trim() };
    }
    if (codes.includes('SENDER_ID_MISMATCH')) {
      return { status: 'invalid_token', reason: `FCM ${status} SENDER_ID_MISMATCH` };
    }
    if (status === 401 || status === 403) {
      return {
        status: 'failed',
        retryable: false,
        reason: `erro de credencial FCM (${status} ${fcmStatus})`.trim(),
      };
    }
    if (status === 429 || status >= 500) {
      return { status: 'failed', retryable: true, reason: `FCM ${status} ${fcmStatus}`.trim() };
    }
    return {
      status: 'failed',
      retryable: false,
      reason: `FCM ${status} ${fcmStatus} ${body.error?.message ?? ''}`.trim(),
    };
  }
}

export function createPushProvider(creds: FcmServiceAccount | null): PushProvider {
  return creds ? new FcmPushProvider(creds) : new NoopPushProvider();
}
