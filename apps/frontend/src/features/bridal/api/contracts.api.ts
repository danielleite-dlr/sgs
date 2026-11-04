import { gql } from '@apollo/client';

/** Todos os campos do tipo `Contract` (SDL em backend/src/graphql/schema/contracts.graphql). */
export const CONTRACT_FIELDS = gql`
  fragment ContractFields on Contract {
    id
    code
    status
    groupId
    groupName
    eventDate
    brideClientId
    brideName
    packageId
    itemsTotal
    discountAmount
    totalAmount
    depositAmount
    balanceDueDaysBefore
    balanceDueDate
    paid
    balance
    depositPaid
    depositPending
    settled
    daysToBalanceDue
    balanceDueSoon
    balanceOverdue
    depositOverdue
    currentVersion
    acceptedVersion
    needsAcceptance
    linkGeneratedAt
    linkExpiresAt
    acceptedAt
    acceptance {
      acceptedName
      acceptedCpfMasked
      acceptedAt
      ip
      textSha256
      version
    }
    currentText
    currentTextSha256
    items {
      id
      groupMemberId
      personName
      serviceId
      packageId
      description
      quantity
      unitPrice
      total
      purpose
    }
    payments {
      id
      kind
      method
      amount
      paidAt
      memberId
      reversesPaymentId
      reversed
      note
    }
    cancelledAt
    cancelReason
    cancelledByParty
    createdAt
  }
`;

export const ContractsQuery = gql`
  ${CONTRACT_FIELDS}
  query Contracts($status: String, $derived: String) {
    contracts(status: $status, derived: $derived) {
      ...ContractFields
    }
  }
`;

export const ContractQuery = gql`
  ${CONTRACT_FIELDS}
  query Contract($id: UUID!) {
    contract(id: $id) {
      ...ContractFields
    }
  }
`;

export const CreateContractMutation = gql`
  ${CONTRACT_FIELDS}
  mutation CreateContract($input: CreateContractInput!) {
    createContract(input: $input) {
      contract {
        ...ContractFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const UpdateContractMutation = gql`
  ${CONTRACT_FIELDS}
  mutation UpdateContract($id: UUID!, $input: UpdateContractInput!) {
    updateContract(id: $id, input: $input) {
      contract {
        ...ContractFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const GenerateContractLinkMutation = gql`
  ${CONTRACT_FIELDS}
  mutation GenerateContractLink($id: UUID!) {
    generateContractLink(id: $id) {
      url
      expiresAt
      contract {
        ...ContractFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

const SETTINGS_FIELDS = `
  balanceDueDaysBefore
  templateBody
  isDefaultTemplate
  cancellationClause
  isDefaultClause
  alertDepositUnpaidDays
  alertNotAcceptedDays
  alertCompanionDepositDays
  scheduleDayStart
  scheduleDayEnd
  templateVariables
  missingVariables
`;

export const ContractSettingsQuery = gql`
  query ContractSettings {
    contractSettings {
      ${SETTINGS_FIELDS}
    }
  }
`;

export const UpdateContractSettingsMutation = gql`
  mutation UpdateContractSettings($input: UpdateContractSettingsInput!) {
    updateContractSettings(input: $input) {
      settings {
        ${SETTINGS_FIELDS}
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const RecordContractPaymentMutation = gql`
  ${CONTRACT_FIELDS}
  mutation RecordContractPayment($input: RecordContractPaymentInput!) {
    recordContractPayment(input: $input) {
      contract {
        ...ContractFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const ReverseContractPaymentMutation = gql`
  ${CONTRACT_FIELDS}
  mutation ReverseContractPayment($input: ReverseContractPaymentInput!) {
    reverseContractPayment(input: $input) {
      contract {
        ...ContractFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const ContractCancellationPreviewQuery = gql`
  query ContractCancellationPreview($contractId: UUID!, $party: String!) {
    contractCancellationPreview(contractId: $contractId, party: $party) {
      paid
      retained
      refund
      party
    }
  }
`;

export const CancelContractMutation = gql`
  ${CONTRACT_FIELDS}
  mutation CancelContract($input: CancelContractInput!) {
    cancelContract(input: $input) {
      contract {
        ...ContractFields
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const ContractPdfQuery = gql`
  query ContractPdf($id: UUID!) {
    contractPdf(id: $id) {
      filename
      base64
    }
  }
`;

/** Consulta mínima do grupo para o formulário (independente do api do 04-13). */
export const ContractGroupQuery = gql`
  query ContractGroup($id: UUID!) {
    bridalGroup(id: $id) {
      id
      name
      eventDate
      status
      contractId
      packageId
      members {
        id
        clientName
        role
        coveredByContract
        services {
          id
          serviceId
          serviceName
          purpose
        }
      }
    }
  }
`;

export const ContractPackagesQuery = gql`
  query ContractPackages {
    packages {
      id
      name
      price
      depositKind
      depositValue
    }
  }
`;

/** Preços-base dos serviços para pré-preencher os itens. */
export const ContractServicesQuery = gql`
  query ContractServices {
    services {
      id
      name
      basePrice
    }
  }
`;

// ---- Tipos ----

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

export interface ContractItemData {
  id: string;
  groupMemberId: string;
  personName: string;
  serviceId: string;
  packageId: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
  purpose: string;
}

export interface ContractPaymentData {
  id: string;
  kind: string;
  method: string;
  amount: string;
  paidAt: string;
  memberId: string | null;
  reversesPaymentId: string | null;
  reversed: boolean;
  note: string | null;
}

export interface ContractAcceptanceData {
  acceptedName: string;
  acceptedCpfMasked: string;
  acceptedAt: string;
  ip: string;
  textSha256: string;
  version: number;
}

export interface ContractData {
  id: string;
  code: string;
  status: string;
  groupId: string;
  groupName: string;
  eventDate: string;
  brideClientId: string;
  brideName: string;
  packageId: string | null;
  itemsTotal: string;
  discountAmount: string;
  totalAmount: string;
  depositAmount: string;
  balanceDueDaysBefore: number;
  balanceDueDate: string;
  paid: string;
  balance: string;
  depositPaid: string;
  depositPending: string;
  settled: boolean;
  daysToBalanceDue: number;
  balanceDueSoon: boolean;
  balanceOverdue: boolean;
  depositOverdue: boolean;
  currentVersion: number;
  acceptedVersion: number | null;
  needsAcceptance: boolean;
  linkGeneratedAt: string | null;
  linkExpiresAt: string | null;
  acceptedAt: string | null;
  acceptance: ContractAcceptanceData | null;
  currentText: string;
  currentTextSha256: string;
  items: ContractItemData[];
  payments: ContractPaymentData[];
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelledByParty: string | null;
  createdAt: string;
}

export interface ContractPayloadResult {
  contract: ContractData | null;
  errors: UserError[];
}

export interface ContractsResult {
  contracts: ContractData[];
}
export interface ContractResult {
  contract: ContractData | null;
}
export interface CreateContractResult {
  createContract: ContractPayloadResult;
}
export interface UpdateContractResult {
  updateContract: ContractPayloadResult;
}
export interface GenerateContractLinkResult {
  generateContractLink: {
    url: string | null;
    expiresAt: string | null;
    contract: ContractData | null;
    errors: UserError[];
  };
}
export interface RecordContractPaymentResult {
  recordContractPayment: ContractPayloadResult;
}
export interface ReverseContractPaymentResult {
  reverseContractPayment: ContractPayloadResult;
}
export interface CancelContractResult {
  cancelContract: ContractPayloadResult;
}
export interface ContractCancellationPreviewResult {
  contractCancellationPreview: { paid: string; retained: string; refund: string; party: string };
}
export interface ContractPdfResult {
  contractPdf: { filename: string; base64: string } | null;
}

export interface ContractSettingsData {
  balanceDueDaysBefore: number;
  templateBody: string;
  isDefaultTemplate: boolean;
  cancellationClause: string;
  isDefaultClause: boolean;
  alertDepositUnpaidDays: number;
  alertNotAcceptedDays: number;
  alertCompanionDepositDays: number;
  scheduleDayStart: string;
  scheduleDayEnd: string;
  templateVariables: string[];
  missingVariables: string[];
}
export interface ContractSettingsResult {
  contractSettings: ContractSettingsData;
}
export interface UpdateContractSettingsResult {
  updateContractSettings: { settings: ContractSettingsData | null; errors: UserError[] };
}

export interface ContractGroupMember {
  id: string;
  clientName: string;
  role: string;
  coveredByContract: boolean;
  services: Array<{ id: string; serviceId: string; serviceName: string; purpose: string }>;
}
export interface ContractGroupResult {
  bridalGroup: {
    id: string;
    name: string;
    eventDate: string;
    status: string;
    contractId: string | null;
    packageId: string | null;
    members: ContractGroupMember[];
  } | null;
}
export interface ContractPackagesResult {
  packages: Array<{
    id: string;
    name: string;
    price: string;
    depositKind: 'fixed' | 'percent' | null;
    depositValue: string | null;
  }>;
}
export interface ContractServicesResult {
  services: Array<{ id: string; name: string; basePrice: string }>;
}
