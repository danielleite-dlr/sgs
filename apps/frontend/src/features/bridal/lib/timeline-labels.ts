export const TIMELINE_ERROR_MESSAGES: Record<string, string> = {
  TIMELINE_RULES_MISSING:
    'Este pacote não tem cronograma configurado. Escolha outro pacote ou configure as etapas em Catálogo › Pacotes › Cronograma do dia.',
  BEFORE_MIDNIGHT: 'O cronograma começaria antes da meia-noite. Escolha uma saída mais tarde.',
  INVALID_DEPARTURE: 'Informe a saída no formato HH:MM.',
  TIMELINE_INCOMPLETE: 'Faltam informações para confirmar o cronograma.',
  TIMELINE_CONFLICT: 'Algum horário da noiva está ocupado para a profissional escolhida.',
  TIMELINE_AMBIGUOUS_APPOINTMENTS:
    'A noiva tem mais de um agendamento do mesmo serviço. Ajuste a agenda antes de confirmar.',
  TIMELINE_REORDER_CONFLICT:
    'Não foi possível reorganizar os horários da noiva sem conflito. Revise a agenda.',
  GROUP_NOT_ACTIVE: 'O grupo não está ativo.',
  NO_BRIDE: 'O grupo não tem noiva cadastrada.',
  INVALID_COMPANIONS_READY_TIME: 'Horário "acompanhantes prontas até" inválido.',
  COMPANIONS_READY_BY_OUTSIDE_EVENT_DAY:
    'O horário "acompanhantes prontas até" deve ser no dia do evento.',
};

/** Mensagem em linguagem clara; usa a do servidor quando o código é desconhecido. */
export function timelineErrorMessage(e: { code: string; message: string }): string {
  return TIMELINE_ERROR_MESSAGES[e.code] ?? e.message;
}

export const RULE_LABEL: Record<string, string> = {
  TIMELINE_AFTER_REGISTRY: 'Termina depois do make-off ou da saída das acompanhantes',
  TIMELINE_PROFESSIONAL_WITH_BRIDE: 'Usa a profissional da noiva',
};

/** Rótulo curto dos avisos da simulação. */
export const WARNING_LABEL: Record<string, string> = {
  ARRIVAL_BEFORE_06: 'Chegada antes das 06h',
  PROFESSIONAL_UNDEFINED: 'Profissional a definir',
  NO_BRIDAL_PROFESSIONAL: 'Ninguém marcado para noiva/debutante',
  NO_FREE_PROFESSIONAL: 'Sem profissional livre',
};
