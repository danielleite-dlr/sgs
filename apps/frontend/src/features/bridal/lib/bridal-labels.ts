export const ROLE_LABEL: Record<string, string> = {
  bride: 'Noiva',
  companion: 'Acompanhante',
};

export const LOCATION_LABEL: Record<string, string> = {
  studio: 'No estúdio',
  external: 'Externo',
};

export const GROUP_STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const PURPOSE_LABEL: Record<string, string> = {
  event: 'Evento',
  trial: 'Teste',
};

export const FALLBACK_REASON_LABEL: Record<string, string> = {
  NO_API_KEY: 'IA não configurada — sugestão simples.',
  API_ERROR: 'IA indisponível no momento — sugestão simples.',
  INVALID_OUTPUT: 'A IA não gerou uma agenda válida — sugestão simples.',
  LIMIT_REACHED: 'Limite diário de sugestões da IA atingido — sugestão simples.',
};

export const ERROR_MESSAGES: Record<string, string> = {
  SLOT_TAKEN: 'Um dos horários escolhidos já está ocupado para o profissional.',
  TIME_BLOCKED: 'Um dos horários escolhidos cai em um bloqueio da agenda.',
  COVERAGE_LOCKED:
    'Esta pessoa já tem comanda fechada; a cobertura pelo contrato não pode mais ser alterada.',
  MEMBER_IN_CONTRACT: 'Esta pessoa faz parte de um contrato ativo. Ajuste o contrato primeiro.',
  CANCEL_CONTRACT_FIRST: 'Cancele o contrato antes (em Contratos).',
  ALREADY_SCHEDULED: 'A agenda do evento já foi criada para este grupo.',
  NO_PLANNED_SERVICES: 'Nenhuma pessoa tem serviços planejados. Inclua serviços antes de agendar.',
  INVALID_PROPOSAL: 'A proposta de agenda não é válida. Revise as linhas e tente de novo.',
  DEPOSIT_ONLY_FOR_UNCOVERED: 'Sinal só pode ser registrado para pessoa que paga avulso.',
  EVENT_DATE_MISMATCH: 'Os horários precisam estar no dia do evento.',
};

/** Mensagem em linguagem clara; usa a do servidor quando o código é desconhecido. */
export function errorMessage(e: { code: string; message: string }): string {
  return ERROR_MESSAGES[e.code] ?? e.message;
}

export const DEPOSIT_METHODS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credit_card', label: 'Crédito' },
  { value: 'debit_card', label: 'Débito' },
  { value: 'transfer', label: 'Transferência' },
] as const;

/** 'YYYY-MM-DD' -> 'dd/MM/yyyy' */
export function formatEventDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
