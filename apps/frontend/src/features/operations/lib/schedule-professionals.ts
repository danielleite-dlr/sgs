import type { AppointmentData } from '../api/appointments.api';

/** Quantos atendimentos cada profissional tem na lista (já sem cancelados). */
export function countByProfessional(appointments: AppointmentData[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of appointments) counts.set(a.professionalId, (counts.get(a.professionalId) ?? 0) + 1);
  return counts;
}

/**
 * Profissionais com atendimento no período primeiro (quick 261112-cko); dentro de cada bloco a
 * ordem original é mantida, para a coluna de ninguém "pular" só porque ganhou mais um horário.
 */
export function sortProfessionalsByLoad<T extends { id: string }>(
  professionals: T[],
  counts: Map<string, number>,
): T[] {
  const busy = professionals.filter((p) => (counts.get(p.id) ?? 0) > 0);
  const free = professionals.filter((p) => (counts.get(p.id) ?? 0) === 0);
  return [...busy, ...free];
}

export interface BridalGroupOption {
  id: string;
  name: string;
  eventKind: string | null;
  /** Nome da noiva/debutante (membro com papel "bride"), quando estiver na agenda. */
  brideName: string | null;
  /** Clientes distintas do grupo com atendimento no período (noiva + acompanhantes). */
  clientCount: number;
}

/** Grupos de noiva/debutante presentes nos atendimentos, na ordem do primeiro horário. */
export function bridalGroupsOf(appointments: AppointmentData[]): BridalGroupOption[] {
  const sorted = [...appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const groups = new Map<string, BridalGroupOption & { clients: Set<string> }>();
  for (const a of sorted) {
    if (!a.bridalGroupId) continue;
    let g = groups.get(a.bridalGroupId);
    if (!g) {
      g = {
        id: a.bridalGroupId,
        name: a.bridalGroupName ?? 'Noiva',
        eventKind: a.bridalEventKind ?? null,
        brideName: null,
        clientCount: 0,
        clients: new Set(),
      };
      groups.set(a.bridalGroupId, g);
    }
    if (a.bridalRole === 'bride' && !g.brideName) g.brideName = a.client.fullName;
    g.clients.add(a.clientId);
    g.clientCount = g.clients.size;
  }
  return [...groups.values()].map(({ clients: _clients, ...g }) => g);
}
