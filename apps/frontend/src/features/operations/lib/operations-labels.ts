export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'debit_card', label: 'Cartão de débito' },
  { value: 'transfer', label: 'Transferência' },
] as const; // D-09: sem voucher

export const CLIENT_CREDIT_METHOD = { value: 'client_credit', label: 'Crédito do cliente' } as const;

export const ALL_PAYMENT_METHODS = [...PAYMENT_METHODS, CLIENT_CREDIT_METHOD];

export function paymentMethodLabel(v: string): string {
  return ALL_PAYMENT_METHODS.find((m) => m.value === v)?.label ?? v;
}

export const TIME_BLOCK_KINDS = [
  { value: 'folga', label: 'Folga', className: 'border-neutral-500 text-neutral-800' },
  { value: 'intervalo', label: 'Intervalo', className: 'border-warning-500 text-neutral-800' },
  { value: 'feriado', label: 'Feriado', className: 'border-error-500 text-neutral-800' },
  {
    value: 'indisponibilidade',
    label: 'Indisponibilidade',
    className: 'border-info-500 text-neutral-800',
  },
  {
    value: 'deslocamento',
    label: 'Deslocamento',
    className: 'border-warning-500 text-neutral-800',
  },
] as const; // D-02

/** Bloqueios criados à mão (deslocamento é gerado pelo grupo de noivas). */
export const MANUAL_TIME_BLOCK_KINDS = TIME_BLOCK_KINDS.filter((k) => k.value !== 'deslocamento');

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'Em atendimento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

export const CANCEL_REASON_TAGS = [
  { value: 'cliente_desmarcou', label: 'Cliente desmarcou' },
  { value: 'profissional_doente', label: 'Profissional doente' },
  { value: 'no_show', label: 'No-show' },
] as const; // D-15

export const COMANDA_STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  closed: 'Fechada',
  cancelled: 'Cancelada',
};

const CASH_KIND_LABELS: Record<string, string> = {
  deposit_in: 'Sinal',
  payment_in: 'Pagamento',
  change_out: 'Troco',
  reversal: 'Estorno',
  contract_in: 'Entrada de contrato',
  contract_refund: 'Devolução de contrato',
};

/** Tipo do lançamento em português; código desconhecido nunca aparece cru (UX-17). */
export function cashKindLabel(kind: string): string {
  return CASH_KIND_LABELS[kind] ?? 'Outro lançamento';
}
