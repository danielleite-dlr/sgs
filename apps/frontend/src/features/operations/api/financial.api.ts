import { gql } from "@apollo/client";

export const FinancialSummaryQuery = gql`
  query FinancialSummary($from: String!, $to: String!, $granularity: String!) {
    financialSummary(from: $from, to: $to, granularity: $granularity) {
      from
      to
      timezone
      granularity
      billedTotal
      contractBilledTotal
      receivedTotal
      closedComandas
      averageTicket
      commissionsTotal
      buckets {
        bucketStart
        billed
        received
        closedComandas
      }
      receivedByMethod {
        method
        total
      }
    }
  }
`;

export const CashMovementsQuery = gql`
  query CashMovements($from: String!, $to: String!) {
    cashMovements(from: $from, to: $to) {
      id
      kind
      method
      amount
      occurredAt
      comandaId
      comandaCode
      contractCode
      appointmentId
      clientName
      note
    }
  }
`;

export const CommissionRecordsQuery = gql`
  query CommissionRecords($from: String!, $to: String!, $memberId: UUID) {
    commissionRecords(from: $from, to: $to, memberId: $memberId) {
      id
      comandaId
      comandaCode
      comandaItemId
      memberId
      memberName
      kind
      cycle
      itemName
      baseAmount
      chargedAmount
      ruleKind
      ruleValue
      noRule
      calculatedAmount
      reversed
      calculatedAt
    }
  }
`;

export const CommissionTotalsQuery = gql`
  query CommissionTotals($from: String!, $to: String!, $memberId: UUID) {
    commissionTotals(from: $from, to: $to, memberId: $memberId) {
      memberId
      memberName
      total
      records
      noRuleCount
    }
  }
`;

export const ClientCreditBalancesQuery = gql`
  query ClientCreditBalances {
    clientCreditBalances {
      clientId
      clientName
      balance
    }
  }
`;

export const ClientCreditMovementsQuery = gql`
  query ClientCreditMovements($clientId: UUID!) {
    clientCreditMovements(clientId: $clientId) {
      id
      kind
      amount
      reason
      appointmentId
      comandaId
      createdAt
    }
  }
`;

export const AdjustClientCreditMutation = gql`
  mutation AdjustClientCredit($input: AdjustClientCreditInput!) {
    adjustClientCredit(input: $input) {
      balance
      errors {
        code
        message
        field
      }
    }
  }
`;

export interface FinancialBucket {
  bucketStart: string;
  billed: string;
  received: string;
  closedComandas: number;
}

export interface MethodTotal {
  method: string;
  total: string;
}

export interface FinancialSummary {
  from: string;
  to: string;
  timezone: string;
  granularity: string;
  billedTotal: string;
  contractBilledTotal: string;
  receivedTotal: string;
  closedComandas: number;
  averageTicket: string;
  commissionsTotal: string;
  buckets: FinancialBucket[];
  receivedByMethod: MethodTotal[];
}

export interface FinancialSummaryResult {
  financialSummary: FinancialSummary;
}

export interface CashMovementEntry {
  id: string;
  kind: string;
  method: string;
  amount: string;
  occurredAt: string;
  comandaId: string | null;
  comandaCode: string | null;
  contractCode: string | null;
  appointmentId: string | null;
  clientName: string | null;
  note: string | null;
}

export interface CashMovementsResult {
  cashMovements: CashMovementEntry[];
}

export interface CommissionRecordEntry {
  id: string;
  comandaId: string;
  comandaCode: string;
  comandaItemId: string;
  memberId: string;
  memberName: string;
  kind: string;
  cycle: number;
  itemName: string;
  baseAmount: string;
  chargedAmount: string;
  ruleKind: string | null;
  ruleValue: string | null;
  noRule: boolean;
  calculatedAmount: string;
  reversed: boolean;
  calculatedAt: string;
}

export interface CommissionRecordsResult {
  commissionRecords: CommissionRecordEntry[];
}

export interface CommissionMemberTotal {
  memberId: string;
  memberName: string;
  total: string;
  records: number;
  noRuleCount: number;
}

export interface CommissionTotalsResult {
  commissionTotals: CommissionMemberTotal[];
}

export interface ClientCreditBalance {
  clientId: string;
  clientName: string;
  balance: string;
}

export interface ClientCreditBalancesResult {
  clientCreditBalances: ClientCreditBalance[];
}

export interface ClientCreditMovementEntry {
  id: string;
  kind: string;
  amount: string;
  reason: string | null;
  appointmentId: string | null;
  comandaId: string | null;
  createdAt: string;
}

export interface ClientCreditMovementsResult {
  clientCreditMovements: ClientCreditMovementEntry[];
}

export interface AdjustClientCreditResult {
  adjustClientCredit: {
    balance: string | null;
    errors: { code: string; message: string; field?: string | null }[];
  };
}
