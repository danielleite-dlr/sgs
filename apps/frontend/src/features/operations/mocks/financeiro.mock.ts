// Mock data for FinanceiroPage — Phase 3 mockup
// No real backend integration — static data only

export interface KpiCard {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendPct?: string;
}

export const MOCK_KPIS: KpiCard[] = [
  { label: 'Receita do mês',     value: 'R$ 28.450,00', sub: 'Maio 2026',         trend: 'up',   trendPct: '+12% vs mês anterior' },
  { label: 'Comandas fechadas',  value: '143',           sub: 'neste mês',         trend: 'up',   trendPct: '+8 vs mês anterior' },
  { label: 'Ticket médio',       value: 'R$ 199,00',     sub: 'por comanda',       trend: 'neutral' },
  { label: 'Comissão paga',      value: 'R$ 5.690,00',   sub: 'a profissionais',   trend: 'up',   trendPct: '+9% vs mês anterior' },
];

export interface RevenueByDay {
  day: string;
  receita: number;
}

export const MOCK_REVENUE_BY_DAY: RevenueByDay[] = [
  { day: 'Seg 27', receita: 3200 },
  { day: 'Ter 28', receita: 4850 },
  { day: 'Qua 29', receita: 3900 },
  { day: 'Qui 30', receita: 5100 },
  { day: 'Sex 01', receita: 6200 },
  { day: 'Sáb 02', receita: 7800 },
  { day: 'Dom 03', receita: 1400 },
];

export interface PaymentBreakdown {
  name: string;
  value: number;
  color: string;
}

export const MOCK_PAYMENT_BREAKDOWN: PaymentBreakdown[] = [
  { name: 'Pix',               value: 45, color: '#5D54C7' },
  { name: 'Cartão de Crédito', value: 28, color: '#1D9E75' },
  { name: 'Cartão de Débito',  value: 15, color: '#EF9F27' },
  { name: 'Dinheiro',          value: 8,  color: '#D85A30' },
  { name: 'Outros',            value: 4,  color: '#888780' },
];

// Comissões mock data
export type CommissionStatus = 'pendente' | 'pago';

export interface MockCommission {
  id: string;
  professional: string;
  period: string;
  totalEarned: string;
  status: CommissionStatus;
  comandas: number;
}

export const MOCK_COMMISSIONS: MockCommission[] = [
  { id: 'c1', professional: 'Ana Souza',    period: 'Maio 2026',  totalEarned: 'R$ 1.840,00', status: 'pendente', comandas: 34 },
  { id: 'c2', professional: 'Bruno Lima',   period: 'Maio 2026',  totalEarned: 'R$ 1.120,00', status: 'pendente', comandas: 21 },
  { id: 'c3', professional: 'Carla Reis',   period: 'Maio 2026',  totalEarned: 'R$ 930,00',   status: 'pago',     comandas: 28 },
  { id: 'c4', professional: 'Diego Melo',   period: 'Maio 2026',  totalEarned: 'R$ 680,00',   status: 'pendente', comandas: 15 },
  { id: 'c5', professional: 'Elena Costa',  period: 'Maio 2026',  totalEarned: 'R$ 1.120,00', status: 'pago',     comandas: 19 },
  { id: 'c6', professional: 'Ana Souza',    period: 'Abril 2026', totalEarned: 'R$ 1.640,00', status: 'pago',     comandas: 30 },
  { id: 'c7', professional: 'Bruno Lima',   period: 'Abril 2026', totalEarned: 'R$ 980,00',   status: 'pago',     comandas: 18 },
  { id: 'c8', professional: 'Carla Reis',   period: 'Abril 2026', totalEarned: 'R$ 850,00',   status: 'pago',     comandas: 25 },
];

/**
 * Unique list of professionals derived from MOCK_COMMISSIONS,
 * used by the ComissoesCalculadasPage filter dropdown.
 */
export const MOCK_PROFESSIONALS: string[] = Array.from(
  new Set(MOCK_COMMISSIONS.map((c) => c.professional)),
).sort();
