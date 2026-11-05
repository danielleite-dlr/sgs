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
    payments: c.payments.map((p) => ({
      __typename: 'ContractPaymentView',
      ...p,
    })),
  };
}

const STUDIO_TEXTS = {
  title: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS',
  intro: 'Pelo presente instrumento particular, as partes abaixo se obrigam.',
  parties: '**CONTRATADA:** {{studio_nome}}.',
  trialNote: 'Os testes ocorrem em data a combinar.',
  clauses: 'Cláusula 1. Desistência em até {{prazo_desistencia_dias}} dias.',
};

/** Configurações de contrato (com __typename, para o MockedProvider). */
export function makeSettings(over: Record<string, unknown> = {}) {
  return {
    __typename: 'ContractSettings',
    balanceDueDaysBefore: 7,
    cancellationClause: 'Cláusula padrão de cancelamento do estúdio.',
    isDefaultClause: true,
    alertDepositUnpaidDays: 3,
    alertNotAcceptedDays: 5,
    alertCompanionDepositDays: 30,
    scheduleDayStart: '08:00',
    scheduleDayEnd: '20:00',
    studio: {
      __typename: 'ContractStudioInfo',
      name: 'Studio JS',
      cnpj: '12.345.678/0001-95',
      address: 'Rua das Flores, 100, Centro',
      representative: 'Joana Silva',
      representativeRg: '12.345.678-9',
      forumCity: 'São Paulo',
      forumUf: 'SP',
    },
    withdrawalNoticeDays: 7,
    texts: { __typename: 'ContractTexts', ...STUDIO_TEXTS },
    textsDefault: {
      __typename: 'ContractTextsDefaultFlags',
      title: true,
      intro: true,
      parties: true,
      trialNote: true,
      clauses: true,
    },
    defaultTexts: { __typename: 'ContractTexts', ...STUDIO_TEXTS },
    textVariables: ['noiva', 'total', 'prazo_desistencia_dias'],
    letterhead: null,
    ...over,
  };
}
