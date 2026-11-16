export const PUSH_QUEUE = 'push-notifications';
export const PUSH_PROVIDER = 'PUSH_PROVIDER';
export const PUSH_KINDS = [
  'appointment.created',
  'appointment.cancelled',
  'bridal.scheduled',
  'bridal.cancelled',
] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export type PushJob =
  | {
      kind: 'appointment.created' | 'appointment.cancelled' | 'bridal.scheduled';
      orgId: string;
      actorMemberId: string;
      appointmentIds: string[];
    }
  | {
      kind: 'bridal.cancelled';
      orgId: string;
      actorMemberId: string;
      since: string;
      groupId?: string | null;
      contractId?: string | null;
    };

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}

export type PushSendResult =
  | { status: 'sent' }
  | { status: 'invalid_token'; reason: string }
  | { status: 'failed'; retryable: boolean; reason: string };

export interface PushProvider {
  readonly enabled: boolean;
  send(token: string, message: PushMessage): Promise<PushSendResult>;
}
