import { useQuery } from '@apollo/client';
import { useMemo } from 'react';
import { AppointmentsQuery, type AppointmentsQueryResult } from '../../api/appointments.api';
import { todayAppointmentsWindow } from '../../lib/operational-dashboard';

// Mesmas variáveis nos dois blocos: o Apollo deduplica a requisição.
export function useTodayAppointments() {
  const variables = useMemo(() => ({ ...todayAppointmentsWindow(), professionalId: null }), []);
  return useQuery<AppointmentsQueryResult>(AppointmentsQuery, {
    variables,
    fetchPolicy: 'cache-and-network',
  });
}
