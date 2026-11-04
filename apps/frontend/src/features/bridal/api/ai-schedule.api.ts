import { gql } from '@apollo/client';
import { BRIDAL_GROUP_FIELDS } from './bridal.api';
import type { BridalGroupData, BridalUserError } from './bridal.api';

export const SuggestBridalScheduleMutation = gql`
  mutation SuggestBridalSchedule($groupId: UUID!) {
    suggestBridalSchedule(groupId: $groupId) {
      suggestion {
        id
        source
        model
        cached
        fallbackReason
        items {
          personRef
          groupMemberId
          personLabel
          role
          serviceId
          serviceName
          professionalId
          professionalName
          startsAt
          endsAt
        }
        unscheduled {
          groupMemberId
          personLabel
          serviceId
          serviceName
        }
        warnings
        dayStart
        dayEnd
        readyBy
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const ConfirmBridalScheduleMutation = gql`
  mutation ConfirmBridalSchedule($input: ConfirmBridalScheduleInput!) {
    confirmBridalSchedule(input: $input) {
      appointmentIds
      group {
        ...BridalGroupFields
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${BRIDAL_GROUP_FIELDS}
`;

export interface AiScheduleItem {
  personRef: string;
  groupMemberId: string;
  personLabel: string;
  role: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
}

export interface AiScheduleUnscheduled {
  groupMemberId: string;
  personLabel: string;
  serviceId: string;
  serviceName: string;
}

export interface AiScheduleSuggestion {
  id: string;
  source: string;
  model: string | null;
  cached: boolean;
  fallbackReason: string | null;
  items: AiScheduleItem[];
  unscheduled: AiScheduleUnscheduled[];
  warnings: string[];
  dayStart: string;
  dayEnd: string;
  readyBy: string;
}

export interface SuggestBridalScheduleResult {
  suggestBridalSchedule: {
    suggestion: AiScheduleSuggestion | null;
    errors: BridalUserError[];
  };
}

export interface ConfirmBridalScheduleResult {
  confirmBridalSchedule: {
    appointmentIds: string[];
    group: BridalGroupData | null;
    errors: BridalUserError[];
  };
}
