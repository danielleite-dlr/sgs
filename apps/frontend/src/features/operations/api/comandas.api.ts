import { gql } from '@apollo/client';

/** Todos os campos do tipo `Comanda` (SDL em backend/src/graphql/schema/comandas.graphql). */
export const COMANDA_FIELDS = gql`
  fragment ComandaFields on Comanda {
    id
    code
    status
    clientId
    client {
      id
      fullName
      phone
    }
    openedAt
    closedAt
    closeCycle
    total
    covered
    owed
    paid
    remaining
    change
    canClose
    closeError
    clientCreditBalance
    appointmentIds
    hasCommissionWarnings
    items {
      id
      kind
      serviceId
      productId
      packageId
      appointmentId
      serviceVariantId
      professionalId
      professional {
        id
        displayName
      }
      name
      quantity
      listUnitPrice
      unitPrice
      total
      contractId
      contractCode
    }
    payments {
      id
      method
      amount
      paidAt
      memberId
    }
    commissions {
      id
      comandaItemId
      memberId
      memberName
      itemName
      kind
      cycle
      baseAmount
      chargedAmount
      calculatedAmount
      noRule
      reversed
    }
  }
`;

export const ComandaQuery = gql`
  ${COMANDA_FIELDS}
  query Comanda($id: UUID!) {
    comanda(id: $id) {
      ...ComandaFields
    }
  }
`;

export const ComandasQuery = gql`
  ${COMANDA_FIELDS}
  query Comandas($from: String!, $to: String!, $status: String, $clientId: UUID) {
    comandas(from: $from, to: $to, status: $status, clientId: $clientId) {
      ...ComandaFields
    }
  }
`;

export const OpenWalkInComandaMutation = gql`
  ${COMANDA_FIELDS}
  mutation OpenWalkInComanda($input: OpenWalkInComandaInput!) {
    openWalkInComanda(input: $input) {
      comanda {
        ...ComandaFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const AddComandaItemMutation = gql`
  ${COMANDA_FIELDS}
  mutation AddComandaItem($input: AddComandaItemInput!) {
    addComandaItem(input: $input) {
      comanda {
        ...ComandaFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const RemoveComandaItemMutation = gql`
  ${COMANDA_FIELDS}
  mutation RemoveComandaItem($comandaId: UUID!, $itemId: UUID!) {
    removeComandaItem(comandaId: $comandaId, itemId: $itemId) {
      comanda {
        ...ComandaFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const AddComandaPackageMutation = gql`
  ${COMANDA_FIELDS}
  mutation AddComandaPackage($input: AddComandaPackageInput!) {
    addComandaPackage(input: $input) {
      comanda {
        ...ComandaFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const AddComandaPaymentMutation = gql`
  ${COMANDA_FIELDS}
  mutation AddComandaPayment($input: AddComandaPaymentInput!) {
    addComandaPayment(input: $input) {
      comanda {
        ...ComandaFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const RemoveComandaPaymentMutation = gql`
  ${COMANDA_FIELDS}
  mutation RemoveComandaPayment($comandaId: UUID!, $paymentId: UUID!) {
    removeComandaPayment(comandaId: $comandaId, paymentId: $paymentId) {
      comanda {
        ...ComandaFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const CloseComandaMutation = gql`
  ${COMANDA_FIELDS}
  mutation CloseComanda($id: UUID!) {
    closeComanda(id: $id) {
      comanda {
        ...ComandaFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const ReopenComandaMutation = gql`
  ${COMANDA_FIELDS}
  mutation ReopenComanda($input: ReopenComandaInput!) {
    reopenComanda(input: $input) {
      comanda {
        ...ComandaFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

// ---- TypeScript response shapes ----

export interface ComandaItemData {
  id: string;
  kind: string;
  serviceId: string | null;
  productId: string | null;
  packageId: string | null;
  appointmentId: string | null;
  serviceVariantId: string | null;
  professionalId: string;
  professional: { id: string; displayName: string };
  name: string;
  quantity: number;
  listUnitPrice: string;
  unitPrice: string;
  total: string;
  contractId?: string | null;
  contractCode?: string | null;
}

export interface ComandaPaymentData {
  id: string;
  method: string;
  amount: string;
  paidAt: string;
  memberId: string | null;
}

export interface ComandaCommissionData {
  id: string;
  comandaItemId: string;
  memberId: string;
  memberName: string;
  itemName: string;
  kind: string;
  cycle: number;
  baseAmount: string;
  chargedAmount: string;
  calculatedAmount: string;
  noRule: boolean;
  reversed: boolean;
}

export interface ComandaData {
  id: string;
  code: string;
  status: string;
  clientId: string;
  client: { id: string; fullName: string; phone: string | null };
  openedAt: string;
  closedAt: string | null;
  closeCycle: number;
  total: string;
  /** Parte coberta por contrato de noiva (D-08). */
  covered: string;
  /** Valor a pagar = total - covered; remaining/change/canClose são sobre ele. */
  owed: string;
  paid: string;
  remaining: string;
  change: string;
  canClose: boolean;
  closeError: string | null;
  clientCreditBalance: string;
  appointmentIds: string[];
  hasCommissionWarnings: boolean;
  items: ComandaItemData[];
  payments: ComandaPaymentData[];
  commissions: ComandaCommissionData[];
}

export interface ComandaUserError {
  code: string;
  message: string;
  field?: string | null;
}

export interface ComandaPayloadResult {
  comanda: ComandaData | null;
  errors: ComandaUserError[];
}

export interface ComandaQueryResult {
  comanda: ComandaData | null;
}
export interface ComandasQueryResult {
  comandas: ComandaData[];
}
export interface OpenWalkInComandaResult {
  openWalkInComanda: ComandaPayloadResult;
}
export interface AddComandaItemResult {
  addComandaItem: ComandaPayloadResult;
}
export interface RemoveComandaItemResult {
  removeComandaItem: ComandaPayloadResult;
}
export interface AddComandaPackageResult {
  addComandaPackage: ComandaPayloadResult;
}
export interface AddComandaPaymentResult {
  addComandaPayment: ComandaPayloadResult;
}
export interface RemoveComandaPaymentResult {
  removeComandaPayment: ComandaPayloadResult;
}
export interface CloseComandaResult {
  closeComanda: ComandaPayloadResult;
}
export interface ReopenComandaResult {
  reopenComanda: ComandaPayloadResult;
}
