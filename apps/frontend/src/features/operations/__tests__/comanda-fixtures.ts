import type { ComandaData } from '../api/comandas.api';

export function makeComanda(over: Partial<ComandaData> = {}): ComandaData {
  return {
    id: 'cm1',
    code: 'C-2026-001',
    status: 'open',
    clientId: 'c1',
    client: { id: 'c1', fullName: 'Maria Souza', phone: '(11) 98765-4321' },
    openedAt: '2026-11-02T13:00:00.000Z',
    closedAt: null,
    closeCycle: 0,
    total: '135.00',
    covered: '0.00',
    owed: '135.00',
    paid: '0.00',
    remaining: '135.00',
    change: '0.00',
    canClose: false,
    closeError: 'INSUFFICIENT_PAYMENT',
    clientCreditBalance: '0.00',
    appointmentIds: [],
    hasCommissionWarnings: false,
    items: [],
    payments: [],
    commissions: [],
    ...over,
  };
}
