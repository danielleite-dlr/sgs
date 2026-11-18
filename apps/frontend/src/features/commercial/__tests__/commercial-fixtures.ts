/**
 * Helpers e dados de exemplo para os testes das telas do Comercial.
 * Só para testes: não importar de código de produção.
 */
import { useAuthStore } from '@/infrastructure/stores/auth.store';

export function setRole(roleName: string | null, memberId: string | null = 'm-1'): void {
  useAuthStore.setState({ roleName, memberId });
}

/** As 6 etapas padrão (D-07). Ganho e Perdido são etapas de sistema. */
export const STAGES = [
  { id: 'st-novo', name: 'Novo', color: '#3b82f6', position: 0, slaDays: 1, kind: 'OPEN' },
  { id: 'st-contato', name: 'Contato', color: '#8b5cf6', position: 1, slaDays: 2, kind: 'OPEN' },
  { id: 'st-proposta', name: 'Proposta', color: '#f59e0b', position: 2, slaDays: 3, kind: 'OPEN' },
  {
    id: 'st-negociacao',
    name: 'Negociação',
    color: '#ec4899',
    position: 3,
    slaDays: 5,
    kind: 'OPEN',
  },
  { id: 'st-ganho', name: 'Ganho', color: '#22c55e', position: 4, slaDays: null, kind: 'WON' },
  { id: 'st-perdido', name: 'Perdido', color: '#ef4444', position: 5, slaDays: null, kind: 'LOST' },
] as const;

export const LEAD_ANA = {
  id: 'lead-ana',
  fullName: 'Ana Souza',
  phone: '11999990000',
  email: 'ana@example.com',
  source: 'INSTAGRAM',
  responsibleMemberId: 'm-1',
  linkedClientId: null,
};

export const DEAL_ANA_NOIVA = {
  id: 'deal-ana-noiva',
  leadId: LEAD_ANA.id,
  stageId: 'st-novo',
  type: 'NOIVA',
  eventDate: '2027-05-15',
  packageId: null,
  discount: 0,
  finalValue: 0,
  responsibleMemberId: 'm-1',
  status: 'OPEN',
};
