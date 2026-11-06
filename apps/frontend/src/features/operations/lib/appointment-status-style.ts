// Cor da borda esquerda (e do ponto do selo) por status do agendamento (fase 6, D-11).
export const STATUS_SPINE_COLORS: Record<string, string> = {
  scheduled: '#570080',
  confirmed: '#1B7A43',
  in_progress: '#0E61A8',
  completed: '#49454F',
  no_show: '#BA1A1A',
  cancelled: '#BA1A1A',
};

const STATUS_SPINE_FALLBACK = '#6B6670';

export function statusSpineColor(status: string): string {
  return STATUS_SPINE_COLORS[status] ?? STATUS_SPINE_FALLBACK;
}
