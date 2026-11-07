import { gql } from "@apollo/client";

// Contratos para o Início (quick 261107-in8): só o que o painel mostra, sem
// currentText/items/payments/installments do ContractFields. Filtro de status no cliente.
export const DashboardContractsQuery = gql`
  query DashboardContracts {
    contracts {
      id
      code
      status
      groupId
      eventDate
      eventKind
      brideName
      totalAmount
      paid
      settled
    }
  }
`;

export interface DashboardContract {
  id: string;
  code: string;
  status: string;
  groupId: string;
  eventDate: string;
  eventKind: string;
  brideName: string;
  totalAmount: string;
  paid: string;
  settled: boolean;
}

export interface DashboardContractsResult {
  contracts: DashboardContract[];
}
