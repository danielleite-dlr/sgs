import type { BridalAppointmentData, BridalGroupData } from '../api/bridal.api';
import type { ScheduleRow } from './schedule-rows';

export interface TrialEntry {
  memberId: string;
  personLabel: string;
  role: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  /** Atendimento de teste já agendado (não cancelado), se houver. */
  scheduled: BridalAppointmentData | null;
}

/** Um item por (pessoa, serviço de teste), com o atendimento de teste ativo quando existe. */
export function trialEntriesFor(group: BridalGroupData): TrialEntry[] {
  const trialAppts = (group.appointments ?? []).filter(
    (a) => a.purpose === 'trial' && a.status !== 'cancelled',
  );
  const out: TrialEntry[] = [];
  for (const m of group.members) {
    for (const s of m.services.filter((x) => x.purpose === 'trial')) {
      // BridalAppointment não traz serviceId: casa por pessoa + nome do serviço.
      const scheduled =
        trialAppts.find((a) => a.groupMemberId === m.id && a.serviceName === s.serviceName) ?? null;
      out.push({
        memberId: m.id,
        personLabel: m.clientName,
        role: m.role,
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        durationMinutes: s.durationMinutes,
        scheduled,
      });
    }
  }
  return out;
}

/**
 * Linhas do "Agendar teste": só os serviços de teste ainda sem agendamento. D-01: a profissional
 * vem do atendimento ativo do EVENTO da mesma pessoa e serviço; sem evento agendado fica em
 * branco (a usuária escolhe, inclusive "A definir") e o teste não é bloqueado.
 */
export function trialRowsFor(group: BridalGroupData): ScheduleRow[] {
  const eventAppts = (group.appointments ?? []).filter(
    (a) => a.status !== 'cancelled' && a.purpose !== 'trial',
  );
  const rows: ScheduleRow[] = [];
  for (const e of trialEntriesFor(group).filter((x) => !x.scheduled)) {
    const ev = eventAppts.find(
      (a) => a.groupMemberId === e.memberId && a.serviceName === e.serviceName,
    );
    rows.push({
      key: `${e.memberId}-${e.serviceId}-trial-${rows.length}`,
      groupMemberId: e.memberId,
      personLabel: e.personLabel,
      role: e.role,
      serviceId: e.serviceId,
      serviceName: e.serviceName,
      professionalId: ev?.professionalId ?? '',
      professionalName: ev?.professionalName,
      durationMinutes: e.durationMinutes,
      date: '',
      start: '',
      end: '',
      purpose: 'trial',
    });
  }
  return rows;
}
