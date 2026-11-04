import type { ContractData } from '../api/contracts.api';

export function makeContract(over: Partial<ContractData> = {}): ContractData {
  return {
    id: 'ct1',
    code: 'CT-2030-001',
    status: 'active',
    groupId: 'g1',
    groupName: 'Casamento Ana',
    eventDate: '2030-06-15',
    brideClientId: 'c1',
    brideName: 'Ana Souza',
    packageId: null,
    itemsTotal: '8000.00',
    discountAmount: '0.00',
    totalAmount: '8000.00',
    depositAmount: '2000.00',
    balanceDueDaysBefore: 7,
    balanceDueDate: '2030-06-08',
    paid: '2000.00',
    balance: '6000.00',
    depositPaid: '2000.00',
    depositPending: '0.00',
    settled: false,
    daysToBalanceDue: 20,
    balanceDueSoon: false,
    balanceOverdue: false,
    depositOverdue: false,
    currentVersion: 1,
    acceptedVersion: null,
    needsAcceptance: false,
    linkGeneratedAt: null,
    linkExpiresAt: null,
    acceptedAt: null,
    acceptance: null,
    currentText: 'TEXTO DO CONTRATO',
    currentTextSha256: 'abcdef1234567890'.repeat(4),
    items: [
      {
        id: 'it1',
        groupMemberId: 'm1',
        personName: 'Ana Souza',
        serviceId: 's1',
        packageId: null,
        description: 'Maquiagem noiva',
        quantity: 1,
        unitPrice: '8000.00',
        total: '8000.00',
        purpose: 'event',
      },
    ],
    payments: [],
    cancelledAt: null,
    cancelReason: null,
    cancelledByParty: null,
    createdAt: '2030-01-01T10:00:00.000Z',
    ...over,
  };
}

/** Acrescenta __typename (o MockedProvider padrão exige para fragmentos). */
export function withTypenames(c: ContractData) {
  return {
    __typename: 'Contract',
    ...c,
    acceptance: c.acceptance ? { __typename: 'ContractAcceptanceView', ...c.acceptance } : null,
    items: c.items.map((i) => ({ __typename: 'ContractItem', ...i })),
    payments: c.payments.map((p) => ({ __typename: 'ContractPaymentView', ...p })),
  };
}
