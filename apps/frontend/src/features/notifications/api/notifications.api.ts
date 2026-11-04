import { gql, useMutation, useQuery } from '@apollo/client';

export const UnreadNotificationCountQuery = gql`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const NotificationsQuery = gql`
  query Notifications($unreadOnly: Boolean) {
    notifications(unreadOnly: $unreadOnly) {
      id
      kind
      payload
      readAt
      createdAt
    }
  }
`;

export const MarkNotificationReadMutation = gql`
  mutation MarkNotificationRead($input: MarkReadInput!) {
    markNotificationRead(input: $input) {
      id
      readAt
    }
  }
`;

export const MarkAllNotificationsReadMutation = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export interface NotificationData {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadNotificationCountResult {
  unreadNotificationCount: number;
}

export interface NotificationsResult {
  notifications: NotificationData[];
}

/** Contador do sino; atualiza sozinho a cada 60 s. */
export function useUnreadNotificationCount() {
  return useQuery<UnreadNotificationCountResult>(UnreadNotificationCountQuery, {
    pollInterval: 60000,
  });
}

/** Lista de não lidas; só consulta quando o painel está aberto. */
export function useUnreadNotifications(enabled: boolean) {
  return useQuery<NotificationsResult>(NotificationsQuery, {
    variables: { unreadOnly: true },
    skip: !enabled,
    fetchPolicy: 'cache-and-network',
  });
}

const REFETCH = ['UnreadNotificationCount', 'Notifications'];

export function useMarkNotificationRead() {
  return useMutation(MarkNotificationReadMutation, { refetchQueries: REFETCH });
}

export function useMarkAllNotificationsRead() {
  return useMutation(MarkAllNotificationsReadMutation, { refetchQueries: REFETCH });
}
