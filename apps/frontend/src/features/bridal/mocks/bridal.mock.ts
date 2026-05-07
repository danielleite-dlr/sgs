// Mock data for Phase 4 bridal pages — no backend integration
// Static data only — to be replaced with real GraphQL queries in Phase 4

export type BridalGroupStatus = 'planning' | 'confirmed' | 'completed';
export type ContractStatus = 'current' | 'overdue' | 'settled';
export type InstallmentStatus = 'paid' | 'pending' | 'overdue';

export interface MockBridalGroup {
  id: string;
  brideId: string;
  brideName: string;
  bridesInitials: string;
  bridesColor: string;
  eventDate: string; // ISO date string
  companionsCount: number;
  status: BridalGroupStatus;
  totalValue: number; // BRL cents
  contractId: string | null;
}

export interface MockContract {
  id: string;
  bridalGroupId: string;
  clientName: string;
  clientInitials: string;
  totalValue: number; // BRL cents
  installmentsTotal: number;
  installmentsPaid: number;
  nextDueDate: string | null; // ISO date string
  status: ContractStatus;
}

export interface MockInstallment {
  id: string;
  contractId: string;
  number: number;
  dueDate: string; // ISO date string
  value: number; // BRL cents
  status: InstallmentStatus;
  paidAt: string | null;
}

export interface MockAiSuggestion {
  suggestedSchedule: MockAiScheduleItem[];
  justification: string;
  generatedAt: string;
}

export interface MockAiScheduleItem {
  professionalId: string;
  professionalName: string;
  service: string;
  startTime: string;
  durationMinutes: number;
}

// ─── Bridal Groups ────────────────────────────────────────────────────────────

export const mockBridalGroups: MockBridalGroup[] = [
  {
    id: 'bg-001',
    brideId: 'c-001',
    brideName: 'Camila Rodrigues',
    bridesInitials: 'CR',
    bridesColor: '#5D54C7',
    eventDate: '2026-06-14',
    companionsCount: 4,
    status: 'confirmed',
    totalValue: 280000,
    contractId: 'ct-001',
  },
  {
    id: 'bg-002',
    brideId: 'c-002',
    brideName: 'Mariana Alves',
    bridesInitials: 'MA',
    bridesColor: '#D85A30',
    eventDate: '2026-07-05',
    companionsCount: 2,
    status: 'planning',
    totalValue: 145000,
    contractId: 'ct-002',
  },
  {
    id: 'bg-003',
    brideId: 'c-003',
    brideName: 'Juliana Ferreira',
    bridesInitials: 'JF',
    bridesColor: '#1D9E75',
    eventDate: '2026-05-24',
    companionsCount: 6,
    status: 'confirmed',
    totalValue: 420000,
    contractId: 'ct-003',
  },
  {
    id: 'bg-004',
    brideId: 'c-004',
    brideName: 'Patricia Nascimento',
    bridesInitials: 'PN',
    bridesColor: '#EF9F27',
    eventDate: '2026-08-22',
    companionsCount: 3,
    status: 'planning',
    totalValue: 195000,
    contractId: null,
  },
  {
    id: 'bg-005',
    brideId: 'c-005',
    brideName: 'Fernanda Lima',
    bridesInitials: 'FL',
    bridesColor: '#3C3489',
    eventDate: '2026-03-15',
    companionsCount: 5,
    status: 'completed',
    totalValue: 360000,
    contractId: 'ct-005',
  },
  {
    id: 'bg-006',
    brideId: 'c-006',
    brideName: 'Isabela Costa',
    bridesInitials: 'IC',
    bridesColor: '#C2185B',
    eventDate: '2026-09-12',
    companionsCount: 1,
    status: 'planning',
    totalValue: 89000,
    contractId: null,
  },
  {
    id: 'bg-007',
    brideId: 'c-007',
    brideName: 'Amanda Souza',
    bridesInitials: 'AS',
    bridesColor: '#558B2F',
    eventDate: '2026-10-03',
    companionsCount: 7,
    status: 'planning',
    totalValue: 510000,
    contractId: null,
  },
];

// ─── Contracts ────────────────────────────────────────────────────────────────

export const mockContracts: MockContract[] = [
  {
    id: 'ct-001',
    bridalGroupId: 'bg-001',
    clientName: 'Camila Rodrigues',
    clientInitials: 'CR',
    totalValue: 280000,
    installmentsTotal: 6,
    installmentsPaid: 3,
    nextDueDate: '2026-05-15',
    status: 'current',
  },
  {
    id: 'ct-002',
    bridalGroupId: 'bg-002',
    clientName: 'Mariana Alves',
    clientInitials: 'MA',
    totalValue: 145000,
    installmentsTotal: 4,
    installmentsPaid: 1,
    nextDueDate: '2026-05-20',
    status: 'current',
  },
  {
    id: 'ct-003',
    bridalGroupId: 'bg-003',
    clientName: 'Juliana Ferreira',
    clientInitials: 'JF',
    totalValue: 420000,
    installmentsTotal: 8,
    installmentsPaid: 2,
    nextDueDate: '2026-05-01',
    status: 'overdue',
  },
  {
    id: 'ct-004',
    bridalGroupId: 'bg-004',
    clientName: 'Patricia Nascimento',
    clientInitials: 'PN',
    totalValue: 195000,
    installmentsTotal: 6,
    installmentsPaid: 6,
    nextDueDate: null,
    status: 'settled',
  },
  {
    id: 'ct-005',
    bridalGroupId: 'bg-005',
    clientName: 'Fernanda Lima',
    clientInitials: 'FL',
    totalValue: 360000,
    installmentsTotal: 8,
    installmentsPaid: 8,
    nextDueDate: null,
    status: 'settled',
  },
  {
    id: 'ct-006',
    bridalGroupId: 'bg-006',
    clientName: 'Isabela Costa',
    clientInitials: 'IC',
    totalValue: 89000,
    installmentsTotal: 3,
    installmentsPaid: 0,
    nextDueDate: '2026-04-28',
    status: 'overdue',
  },
  {
    id: 'ct-007',
    bridalGroupId: 'bg-007',
    clientName: 'Amanda Souza',
    clientInitials: 'AS',
    totalValue: 510000,
    installmentsTotal: 10,
    installmentsPaid: 1,
    nextDueDate: '2026-05-18',
    status: 'current',
  },
  {
    id: 'ct-008',
    bridalGroupId: 'bg-001',
    clientName: 'Larissa Mendes',
    clientInitials: 'LM',
    totalValue: 98000,
    installmentsTotal: 4,
    installmentsPaid: 2,
    nextDueDate: '2026-05-22',
    status: 'current',
  },
];

// ─── Installments (per contract) ─────────────────────────────────────────────

const makeInstallments = (
  contractId: string,
  totalCents: number,
  count: number,
  paid: number,
  firstDueDate: Date,
  overdueFrom?: number, // index (0-based) from which installments are overdue
): MockInstallment[] => {
  const perInstallment = Math.round(totalCents / count);
  return Array.from({ length: count }, (_, i) => {
    const due = new Date(firstDueDate);
    due.setMonth(due.getMonth() + i);
    const isPaid = i < paid;
    const isOverdue = !isPaid && overdueFrom !== undefined && i >= overdueFrom;
    return {
      id: `${contractId}-inst-${i + 1}`,
      contractId,
      number: i + 1,
      dueDate: due.toISOString().split('T')[0],
      value: perInstallment,
      status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
      paidAt: isPaid ? new Date(due.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
    };
  });
};

const INSTALLMENTS_MAP: Record<string, MockInstallment[]> = {
  'ct-001': makeInstallments('ct-001', 280000, 6, 3, new Date('2025-12-15')),
  'ct-002': makeInstallments('ct-002', 145000, 4, 1, new Date('2026-02-20')),
  'ct-003': makeInstallments('ct-003', 420000, 8, 2, new Date('2026-01-01'), 2),
  'ct-004': makeInstallments('ct-004', 195000, 6, 6, new Date('2025-09-10')),
  'ct-005': makeInstallments('ct-005', 360000, 8, 8, new Date('2025-07-15')),
  'ct-006': makeInstallments('ct-006', 89000, 3, 0, new Date('2026-02-28'), 0),
  'ct-007': makeInstallments('ct-007', 510000, 10, 1, new Date('2026-04-18')),
  'ct-008': makeInstallments('ct-008', 98000, 4, 2, new Date('2026-01-22')),
};

export function mockInstallments(contractId: string): MockInstallment[] {
  return INSTALLMENTS_MAP[contractId] ?? [];
}

// ─── AI Suggestion ────────────────────────────────────────────────────────────

export const mockAiSuggestion: MockAiSuggestion = {
  generatedAt: '2026-05-07T10:32:00Z',
  suggestedSchedule: [
    {
      professionalId: 'p-ana',
      professionalName: 'Ana Souza',
      service: 'Penteado da noiva',
      startTime: '07:00',
      durationMinutes: 90,
    },
    {
      professionalId: 'p-carla',
      professionalName: 'Carla Reis',
      service: 'Maquiagem da noiva',
      startTime: '07:30',
      durationMinutes: 75,
    },
    {
      professionalId: 'p-ana',
      professionalName: 'Ana Souza',
      service: 'Penteado da madrinha 1',
      startTime: '08:30',
      durationMinutes: 60,
    },
    {
      professionalId: 'p-elena',
      professionalName: 'Elena Costa',
      service: 'Manicure e pedicure — noiva',
      startTime: '07:00',
      durationMinutes: 75,
    },
    {
      professionalId: 'p-carla',
      professionalName: 'Carla Reis',
      service: 'Maquiagem madrinha 1',
      startTime: '08:45',
      durationMinutes: 60,
    },
  ],
  justification:
    'Com base nas durações dos serviços e na disponibilidade dos 3 profissionais ' +
    'disponíveis no dia, a alocação sugerida minimiza o tempo total de atendimento ' +
    'do grupo de 5 pessoas para 2h15min. A noiva é priorizada no início (07:00) para ' +
    'garantir que esteja pronta antes do horário da cerimônia (10:00). ' +
    'Ana Souza realiza penteados em sequência aproveitando o intervalo de 30 minutos. ' +
    'Carla Reis termina a noiva às 08:45 e imediatamente inicia a madrinha 1, ' +
    'eliminando tempo ocioso. Elena Costa fica exclusivamente responsável pelo ' +
    'serviço de unhas, que pode ser realizado em paralelo sem dependência de slot. ' +
    'Esta configuração reduz o tempo total do grupo em 45 minutos comparado à ' +
    'alocação sequencial padrão.',
};

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

export const BRIDAL_STATUS_LABELS: Record<BridalGroupStatus, string> = {
  planning: 'Em planejamento',
  confirmed: 'Confirmado',
  completed: 'Concluído',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  current: 'Em dia',
  overdue: 'Atrasado',
  settled: 'Quitado',
};

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Atrasado',
};
