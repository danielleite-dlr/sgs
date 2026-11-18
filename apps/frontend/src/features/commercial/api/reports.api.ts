import { gql } from '@apollo/client';

/** SDL em apps/backend/src/graphql/schema/commercial-reports.graphql. */
export interface CommercialStageSummary {
  stageId: string;
  name: string;
  color: string;
  kind: string;
  count: number;
  amount: string;
}

export interface CommercialDashboard {
  periodDays: number;
  newLeadsToday: number;
  newDealsToday: number;
  interactionsToday: number;
  remindersOverdue: number;
  remindersToday: number;
  followUpsPending: number;
  followUps: {
    dealId: string;
    leadId: string;
    leadName: string;
    kind: string;
    stageName: string;
    stageColor: string;
    overdueSince: string;
    assigneeName: string | null;
  }[];
  lastInteractions: {
    id: string;
    leadId: string;
    leadName: string;
    type: string;
    notes: string | null;
    occurredAt: string;
    createdByName: string | null;
  }[];
  stages: CommercialStageSummary[];
  openAmount: string;
  wonCount: number;
  wonAmount: string;
  lostCount: number;
  conversionRate: number | null;
}

export interface CommercialReportFilterInput {
  from: string;
  to: string;
  assigneeMemberId?: string | null;
  stageId?: string | null;
  status?: string | null;
  kind?: string | null;
  source?: string | null;
}

export interface CommercialReport {
  totals: {
    deals: number;
    open: number;
    won: number;
    lost: number;
    openAmount: string;
    wonAmount: string;
    conversionRate: number | null;
  };
  byStage: CommercialStageSummary[];
  byAssignee: {
    memberId: string | null;
    name: string;
    deals: number;
    won: number;
    lost: number;
    wonAmount: string;
  }[];
  bySource: { source: string; label: string; deals: number; won: number }[];
  lostReasons: { code: string; label: string; count: number }[];
  rows: {
    dealId: string;
    leadName: string;
    phone: string | null;
    kind: string;
    eventDate: string | null;
    stageName: string;
    status: string;
    assigneeName: string | null;
    source: string;
    packageName: string | null;
    finalAmount: string | null;
    lostReasonLabel: string | null;
    lostReasonText: string | null;
    createdAt: string;
    closedAt: string | null;
  }[];
  truncated: boolean;
}

export const CommercialDashboardQuery = gql`
  query CommercialDashboard($periodDays: Int) {
    commercialDashboard(periodDays: $periodDays) {
      periodDays
      newLeadsToday
      newDealsToday
      interactionsToday
      remindersOverdue
      remindersToday
      followUpsPending
      followUps {
        dealId
        leadId
        leadName
        kind
        stageName
        stageColor
        overdueSince
        assigneeName
      }
      lastInteractions {
        id
        leadId
        leadName
        type
        notes
        occurredAt
        createdByName
      }
      stages {
        stageId
        name
        color
        kind
        count
        amount
      }
      openAmount
      wonCount
      wonAmount
      lostCount
      conversionRate
    }
  }
`;

export const CommercialReportQuery = gql`
  query CommercialReport($filter: CommercialReportFilter!) {
    commercialReport(filter: $filter) {
      totals {
        deals
        open
        won
        lost
        openAmount
        wonAmount
        conversionRate
      }
      byStage {
        stageId
        name
        color
        kind
        count
        amount
      }
      byAssignee {
        memberId
        name
        deals
        won
        lost
        wonAmount
      }
      bySource {
        source
        label
        deals
        won
      }
      lostReasons {
        code
        label
        count
      }
      rows {
        dealId
        leadName
        phone
        kind
        eventDate
        stageName
        status
        assigneeName
        source
        packageName
        finalAmount
        lostReasonLabel
        lostReasonText
        createdAt
        closedAt
      }
      truncated
    }
  }
`;

export const ExportCommercialReportQuery = gql`
  query ExportCommercialReport($filter: CommercialReportFilter!, $format: String!) {
    exportCommercialReport(filter: $filter, format: $format) {
      filename
      mimeType
      base64
    }
  }
`;

/** 0.5 -> '50%'; sem dados -> '—'. */
export function formatRate(rate: number | null | undefined): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}
