// Mock data for CampaignsPage — Phase 5 mockup
// No real backend integration — static data only

export type CampaignType = 'aniversario' | 'inativos' | 'sazonal' | 'personalizada';
export type CampaignStatus = 'ativa' | 'pausada' | 'rascunho';

export interface MockCampaign {
  id: string;
  name: string;
  type: CampaignType;
  segment: number;         // number of clients in segment
  lastRun: string | null;  // ISO date string or null
  nextRun: string | null;  // ISO date string or null
  status: CampaignStatus;
}

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  aniversario:  'Aniversário',
  inativos:     'Inativos',
  sazonal:      'Sazonal',
  personalizada: 'Personalizada',
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  ativa:    'Ativa',
  pausada:  'Pausada',
  rascunho: 'Rascunho',
};

export const MOCK_CAMPAIGNS: MockCampaign[] = [
  {
    id: 'camp-01',
    name: 'Parabéns, aniversariante!',
    type: 'aniversario',
    segment: 18,
    lastRun: '2026-05-01',
    nextRun: '2026-06-01',
    status: 'ativa',
  },
  {
    id: 'camp-02',
    name: 'Sentimos sua falta',
    type: 'inativos',
    segment: 47,
    lastRun: '2026-04-28',
    nextRun: '2026-05-28',
    status: 'ativa',
  },
  {
    id: 'camp-03',
    name: 'Especial Dia das Mães',
    type: 'sazonal',
    segment: 134,
    lastRun: '2026-05-05',
    nextRun: null,
    status: 'pausada',
  },
  {
    id: 'camp-04',
    name: 'Promoção de inverno — hidratação',
    type: 'sazonal',
    segment: 89,
    lastRun: null,
    nextRun: '2026-06-21',
    status: 'rascunho',
  },
  {
    id: 'camp-05',
    name: 'Clientes VIP — agendamento prioritário',
    type: 'personalizada',
    segment: 23,
    lastRun: '2026-05-03',
    nextRun: '2026-06-03',
    status: 'ativa',
  },
  {
    id: 'camp-06',
    name: 'Reativação 60 dias',
    type: 'inativos',
    segment: 31,
    lastRun: '2026-04-15',
    nextRun: '2026-05-15',
    status: 'pausada',
  },
  {
    id: 'camp-07',
    name: 'Lançamento: novo serviço de sobrancelha',
    type: 'personalizada',
    segment: 210,
    lastRun: null,
    nextRun: null,
    status: 'rascunho',
  },
];
