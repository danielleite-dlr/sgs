export interface PushAppointmentRef {
  id: string;
  professionalId: string;
}

export interface PushTarget {
  memberId: string;
  scope: 'own' | 'all';
  appointmentIds: string[];
}

/**
 * Quem recebe o aviso (D-12/D-13): a profissional de cada atendimento recebe só os
 * dela; ADMIN/MANAGER ativos recebem todos; o autor da ação nunca recebe.
 */
export function resolvePushTargets(a: {
  appointments: PushAppointmentRef[];
  managerMemberIds: string[];
  activeMemberIds: ReadonlySet<string>;
  actorMemberId: string | null;
}): PushTarget[] {
  if (a.appointments.length === 0) return [];

  const managers = [...new Set(a.managerMemberIds)].filter((id) => id !== a.actorMemberId);

  const own = new Map<string, string[]>();
  for (const ap of a.appointments) {
    if (
      ap.professionalId !== a.actorMemberId &&
      a.activeMemberIds.has(ap.professionalId) &&
      !managers.includes(ap.professionalId)
    ) {
      const list = own.get(ap.professionalId) ?? [];
      list.push(ap.id);
      own.set(ap.professionalId, list);
    }
  }

  const allIds = a.appointments.map((x) => x.id);
  return [
    ...[...own.entries()].map(
      ([memberId, appointmentIds]): PushTarget => ({ memberId, scope: 'own', appointmentIds }),
    ),
    ...managers.map(
      (memberId): PushTarget => ({ memberId, scope: 'all', appointmentIds: [...allIds] }),
    ),
  ];
}
