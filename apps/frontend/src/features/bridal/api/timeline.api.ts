import { gql } from '@apollo/client';
import type { BridalUserError } from './bridal.api';

export const TIMELINE_ROW_FIELDS = gql`
  fragment TimelineRowFields on BridalTimelineRow {
    time
    minutes
    name
    label
    kind
    professionalName
    isExtra
    isRegistry
  }
`;

export const BridalTimelinePreviewQuery = gql`
  query BridalTimelinePreview($input: BridalTimelineInput!) {
    bridalTimelinePreview(input: $input) {
      preview {
        groupId
        packageId
        packageName
        departureTime
        brideLabel
        makeProfessionalId
        hairProfessionalId
        rows {
          ...TimelineRowFields
        }
        text
        warnings {
          code
          message
        }
        registryStartsAt
        brideSlots {
          kind
          stepName
          serviceId
          serviceName
          professionalId
          professionalName
          startsAt
          endsAt
        }
        conflicts {
          stepName
          professionalName
          startsAt
          endsAt
          blockedBy
        }
        missing
        canConfirm
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${TIMELINE_ROW_FIELDS}
`;

export const BridalTimelineQuery = gql`
  query BridalTimeline($groupId: UUID!) {
    bridalTimeline(groupId: $groupId) {
      id
      groupId
      packageId
      packageName
      departureTime
      brideLabel
      makeProfessionalId
      hairProfessionalId
      rows {
        ...TimelineRowFields
      }
      text
      warnings {
        code
        message
      }
      registryStartsAt
      registryLabel
      confirmedAt
      confirmedByName
      version
      companionIssues {
        appointmentId
        clientName
        professionalName
        serviceName
        startsAt
        endsAt
        rule
        message
      }
    }
  }
  ${TIMELINE_ROW_FIELDS}
`;

export const ConfirmBridalTimelineMutation = gql`
  mutation ConfirmBridalTimeline($input: BridalTimelineInput!) {
    confirmBridalTimeline(input: $input) {
      timeline {
        id
        groupId
        packageId
        packageName
        departureTime
        brideLabel
        makeProfessionalId
        hairProfessionalId
        rows {
          ...TimelineRowFields
        }
        text
        warnings {
          code
          message
        }
        registryStartsAt
        registryLabel
        confirmedAt
        confirmedByName
        version
        companionIssues {
          appointmentId
          clientName
          professionalName
          serviceName
          startsAt
          endsAt
          rule
          message
        }
      }
      conflicts {
        stepName
        professionalName
        startsAt
        endsAt
        blockedBy
      }
      errors {
        code
        message
        field
      }
    }
  }
  ${TIMELINE_ROW_FIELDS}
`;

export interface TimelineRowData {
  time: string;
  minutes: number;
  name: string;
  label: string | null;
  kind: string;
  professionalName: string | null;
  isExtra: boolean;
  isRegistry: boolean;
}

export interface TimelineWarningData {
  code: string;
  message: string;
}

export interface TimelineConflictData {
  stepName: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  blockedBy: string;
}

export interface TimelineBrideSlotData {
  kind: string;
  stepName: string;
  serviceId: string;
  serviceName: string;
  professionalId: string | null;
  professionalName: string | null;
  startsAt: string;
  endsAt: string;
}

export interface TimelineCompanionIssueData {
  appointmentId: string;
  clientName: string;
  professionalName: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  rule: string;
  message: string;
}

export interface BridalTimelinePreviewData {
  groupId: string;
  packageId: string;
  packageName: string;
  departureTime: string;
  brideLabel: string | null;
  makeProfessionalId: string | null;
  hairProfessionalId: string | null;
  rows: TimelineRowData[];
  text: string;
  warnings: TimelineWarningData[];
  registryStartsAt: string | null;
  brideSlots: TimelineBrideSlotData[];
  conflicts: TimelineConflictData[];
  missing: string[];
  canConfirm: boolean;
}

export interface BridalTimelineData {
  id: string;
  groupId: string;
  packageId: string;
  packageName: string;
  departureTime: string;
  brideLabel: string | null;
  makeProfessionalId: string | null;
  hairProfessionalId: string | null;
  rows: TimelineRowData[];
  text: string;
  warnings: TimelineWarningData[];
  registryStartsAt: string | null;
  registryLabel: string | null;
  confirmedAt: string;
  confirmedByName: string | null;
  version: number;
  companionIssues: TimelineCompanionIssueData[];
}

export interface BridalTimelineInput {
  groupId: string;
  packageId: string;
  departureTime: string;
  brideLabel?: string | null;
  makeProfessionalId?: string | null;
  hairProfessionalId?: string | null;
}

export interface BridalTimelinePreviewResult {
  bridalTimelinePreview: { preview: BridalTimelinePreviewData | null; errors: BridalUserError[] };
}

export interface BridalTimelineResult {
  bridalTimeline: BridalTimelineData | null;
}

export interface ConfirmBridalTimelineResult {
  confirmBridalTimeline: {
    timeline: BridalTimelineData | null;
    conflicts: TimelineConflictData[];
    errors: BridalUserError[];
  };
}
