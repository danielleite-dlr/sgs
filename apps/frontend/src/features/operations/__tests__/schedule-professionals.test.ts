import { describe, expect, it } from 'vitest';
import type { AppointmentData } from '../api/appointments.api';
import {
  bridalGroupsOf,
  countByProfessional,
  sortProfessionalsByLoad,
} from '../lib/schedule-professionals';

function appt(over: Partial<AppointmentData>): AppointmentData {
  return {
    id: 'a',
    professionalId: 'p1',
    clientId: 'c1',
    serviceId: 's',
    startsAt: '2026-11-14T10:00:00.000Z',
    endsAt: '2026-11-14T11:00:00.000Z',
    status: 'scheduled',
    notes: null,
    serviceVariantId: null,
    comandaId: null,
    comandaCode: null,
    comandaStatus: null,
    depositAmount: '0.00',
    cancelReason: null,
    cancelReasonTag: null,
    cancelledAt: null,
    client: { id: over.clientId ?? 'c1', fullName: 'Cliente' },
    professional: { id: 'p1', displayName: 'P' },
    service: { id: 's', name: 'Make' },
    ...over,
  };
}

describe('sortProfessionalsByLoad (quick 261112-cko)', () => {
  it('quem tem atendimento vem primeiro, mantendo a ordem original em cada bloco', () => {
    const pros = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const counts = countByProfessional([
      appt({ id: '1', professionalId: 'd' }),
      appt({ id: '2', professionalId: 'b' }),
      appt({ id: '3', professionalId: 'd' }),
    ]);
    expect(sortProfessionalsByLoad(pros, counts).map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('bridalGroupsOf (quick 261112-cko)', () => {
  it('um item por grupo, com a noiva e o total de clientes (noiva + acompanhantes)', () => {
    const list = [
      appt({ id: '1', startsAt: '2026-11-14T12:00:00.000Z', clientId: 'mae',
        bridalGroupId: 'g2', bridalGroupName: 'Noiva Sheyla', bridalRole: 'companion' }),
      appt({ id: '2', startsAt: '2026-11-14T09:00:00.000Z', clientId: 'natha',
        bridalGroupId: 'g1', bridalGroupName: 'Noiva Nathá', bridalRole: 'bride',
        client: { id: 'natha', fullName: 'Nathá' } }),
      appt({ id: '3', clientId: 'natha', bridalGroupId: 'g1', bridalGroupName: 'Noiva Nathá',
        bridalRole: 'bride', client: { id: 'natha', fullName: 'Nathá' } }),
      appt({ id: '4', clientId: 'izabel', bridalGroupId: 'g1', bridalGroupName: 'Noiva Nathá',
        bridalRole: 'companion' }),
      appt({ id: '5', clientId: 'social' }),
    ];
    expect(bridalGroupsOf(list)).toEqual([
      { id: 'g1', name: 'Noiva Nathá', eventKind: null, brideName: 'Nathá', clientCount: 2 },
      { id: 'g2', name: 'Noiva Sheyla', eventKind: null, brideName: null, clientCount: 1 },
    ]);
  });
});
