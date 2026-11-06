import { gql } from "@apollo/client";
import { ORG_TIMEZONE_DEFAULT, addDays, todayInTimeZone } from "../lib/period";

export type ForecastKind =
  | "appointment"
  | "contract_installment"
  | "contract_balance"
  | "commission"
  | "package_cost"
  | "fixed_expense";

export type ForecastCostGroup = "professional" | "operational" | "fixed";

export interface ForecastItem {
  date: string;
  kind: ForecastKind;
  direction: "in" | "out";
  amount: string;
  label: string;
  refId: string | null;
  overdue: boolean;
  noRule: boolean;
  withoutProfessional: boolean;
  /** Só nas saídas; null nas entradas. */
  costGroup: ForecastCostGroup | null;
}

export interface ForecastBucket {
  start: string;
  end: string;
  inflow: string;
  outflow: string;
  balance: string;
  overdueInflow: string;
  professionalOutflow: string;
  operationalOutflow: string;
  fixedOutflow: string;
}

export interface CashForecast {
  from: string;
  to: string;
  timezone: string;
  inflowTotal: string;
  outflowTotal: string;
  balance: string;
  overdueInflowTotal: string;
  professionalOutflowTotal: string;
  operationalOutflowTotal: string;
  fixedOutflowTotal: string;
  noRuleCount: number;
  withoutProfessionalCount: number;
  buckets: ForecastBucket[];
  items: ForecastItem[];
}

export interface CashForecastResult {
  cashForecast: CashForecast;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: string;
  dueDay: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FixedExpenseInput {
  name: string;
  amount: string;
  dueDay: number;
  active?: boolean;
}

export interface UserError {
  code: string;
  message: string;
  field: string | null;
}

export interface FixedExpensePayload {
  fixedExpense: FixedExpense | null;
  errors: UserError[];
}

export const CashForecastQuery = gql`
  query CashForecast($from: String!, $to: String!) {
    cashForecast(from: $from, to: $to) {
      from
      to
      timezone
      inflowTotal
      outflowTotal
      balance
      overdueInflowTotal
      professionalOutflowTotal
      operationalOutflowTotal
      fixedOutflowTotal
      noRuleCount
      withoutProfessionalCount
      buckets {
        start
        end
        inflow
        outflow
        balance
        overdueInflow
        professionalOutflow
        operationalOutflow
        fixedOutflow
      }
      items {
        date
        kind
        direction
        amount
        label
        refId
        overdue
        noRule
        withoutProfessional
        costGroup
      }
    }
  }
`;

export const FixedExpensesQuery = gql`
  query FixedExpenses {
    fixedExpenses {
      id
      name
      amount
      dueDay
      active
      createdAt
      updatedAt
    }
  }
`;

export const CreateFixedExpenseMutation = gql`
  mutation CreateFixedExpense($input: FixedExpenseInput!) {
    createFixedExpense(input: $input) {
      fixedExpense {
        id
        name
        amount
        dueDay
        active
        createdAt
        updatedAt
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateFixedExpenseMutation = gql`
  mutation UpdateFixedExpense($id: UUID!, $input: FixedExpenseInput!) {
    updateFixedExpense(id: $id, input: $input) {
      fixedExpense {
        id
        name
        amount
        dueDay
        active
        createdAt
        updatedAt
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const DeleteFixedExpenseMutation = gql`
  mutation DeleteFixedExpense($id: UUID!) {
    deleteFixedExpense(id: $id) {
      fixedExpense {
        id
        name
        amount
        dueDay
        active
        createdAt
        updatedAt
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const FORECAST_KIND_LABELS: Record<ForecastKind, string> = {
  appointment: "Agendamento",
  contract_installment: "Parcela de contrato",
  contract_balance: "Restante de contrato",
  commission: "Comissão",
  package_cost: "Outro custo do pacote",
  fixed_expense: "Despesa fixa",
};

export const FORECAST_COST_GROUP_LABELS: Record<ForecastCostGroup, string> = {
  professional: "Custo profissional",
  operational: "Custo operacional",
  fixed: "Custo fixo",
};

/** Janela de `days` dias (padrão 30) a partir de hoje no fuso da organização; `to` é exclusivo. */
export function forecastWindow(
  tz: string = ORG_TIMEZONE_DEFAULT,
  now: Date = new Date(),
  days: number = 30,
): { from: string; to: string } {
  const from = todayInTimeZone(tz, now);
  return { from, to: addDays(from, days) };
}

function ddMm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** "dd/MM – dd/MM"; o fim é exclusivo, então o último dia é endExclusive - 1. */
export function weekLabel(start: string, endExclusive: string): string {
  return `${ddMm(start)} – ${ddMm(addDays(endExclusive, -1))}`;
}
