// Cor da borda esquerda (e do ponto do selo) por status do agendamento (fase 6, D-11/D-26).
export const STATUS_SPINE_COLORS: Record<string, string> = {
  scheduled: '#570080',
  confirmed: '#109868',
  in_progress: '#0E61A8',
  completed: '#49454F',
  no_show: '#C53030',
  cancelled: '#C53030',
};

const STATUS_SPINE_FALLBACK = '#6B7280';

export function statusSpineColor(status: string): string {
  return STATUS_SPINE_COLORS[status] ?? STATUS_SPINE_FALLBACK;
}
