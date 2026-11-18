import { gql } from '@apollo/client';
import type { CommercialMember, CommercialOkPayload, UserError } from './deals.api';

/** SDL em apps/backend/src/graphql/schema/commercial-reminders.graphql. */
export interface CommercialReminder {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  completedAt: string | null;
  notifiedAt: string | null;
  overdue: boolean;
  lead: { id: string; fullName: string; phone: string | null; email: string | null } | null;
  dealId: string | null;
  dealKind: string | null;
  dealEventDate: string | null;
  dealStageName: string | null;
  createdBy: CommercialMember | null;
}

export interface CommercialReminderPayload {
  reminder: CommercialReminder | null;
  errors: UserError[];
}

export type { CommercialOkPayload };

export const REMINDER_FIELDS = gql`
  fragment CommercialReminderFields on CommercialReminder {
    id
    title
    description
    dueAt
    completedAt
    notifiedAt
    overdue
    lead {
      id
      fullName
      phone
      email
    }
    dealId
    dealKind
    dealEventDate
    dealStageName
    createdBy {
      id
      displayName
      roleName
    }
  }
`;

export const CommercialRemindersQuery = gql`
  ${REMINDER_FIELDS}
  query CommercialReminders($filter: CommercialReminderFilter) {
    commercialReminders(filter: $filter) {
      total
      items {
        ...CommercialReminderFields
      }
    }
  }
`;

export const CommercialReminderQuery = gql`
  ${REMINDER_FIELDS}
  query CommercialReminder($id: UUID!) {
    commercialReminder(id: $id) {
      ...CommercialReminderFields
    }
  }
`;

export const CommercialReminderCountsQuery = gql`
  query CommercialReminderCounts {
    commercialReminderCounts {
      overdue
      today
    }
  }
`;

export const CreateCommercialReminderMutation = gql`
  ${REMINDER_FIELDS}
  mutation CreateCommercialReminder($input: CreateCommercialReminderInput!) {
    createCommercialReminder(input: $input) {
      reminder {
        ...CommercialReminderFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateCommercialReminderMutation = gql`
  ${REMINDER_FIELDS}
  mutation UpdateCommercialReminder($input: UpdateCommercialReminderInput!) {
    updateCommercialReminder(input: $input) {
      reminder {
        ...CommercialReminderFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const CompleteCommercialReminderMutation = gql`
  ${REMINDER_FIELDS}
  mutation CompleteCommercialReminder($id: UUID!, $completed: Boolean!) {
    completeCommercialReminder(id: $id, completed: $completed) {
      reminder {
        ...CommercialReminderFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const CommercialLeadNameQuery = gql`
  query CommercialLeadName($id: UUID!) {
    commercialLead(id: $id) {
      id
      fullName
    }
  }
`;

export const DeleteCommercialReminderMutation = gql`
  mutation DeleteCommercialReminder($id: UUID!) {
    deleteCommercialReminder(id: $id) {
      ok
      errors {
        code
        message
        field
      }
    }
  }
`;
