// Tema dos gráficos Recharts no padrão da Previsão de caixa do Stitch (D-26/D-27).
// Verde e laranja cheios só em gráfico e número grande; texto pequeno usa os tons 700.

export const CHART_COLORS = {
  billed: '#521873',
  received: '#109868',
  inflow: '#109868',
  outflow: '#D85A30',
} as const;

export const CHART_GRID_STROKE = '#E5E7EB';

export const CHART_TICK = { fill: '#6B7280', fontSize: 12 } as const;

export const CHART_TOOLTIP_STYLE = {
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  boxShadow: 'none',
  fontSize: 13,
} as const;

/** Botão selecionado do filtro segmentado (D-26): roxo #521873 com texto branco. */
export const SEGMENT_SELECTED_CLASS = 'bg-primary-800 text-white hover:bg-primary-800';
