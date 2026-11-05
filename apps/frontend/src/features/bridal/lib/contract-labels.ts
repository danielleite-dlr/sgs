import type { ContractData } from '../api/contracts.api';

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  awaiting_acceptance: 'Aguardando aceite',
  active: 'Ativo',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  sinal: 'Sinal',
  sinal_parcelado: 'Sinal parcelado',
  a_vista: 'À vista',
};

export function installmentStateLabel(i: {
  state: string;
  overdue: boolean;
}): 'Paga' | 'Vencida' | 'Parcial' | 'Em aberto' {
  if (i.state === 'paid') return 'Paga';
  if (i.overdue) return 'Vencida';
  if (i.state === 'partial') return 'Parcial';
  return 'Em aberto';
}

export const PARTY_LABEL: Record<string, string> = {
  client: 'Pela noiva',
  studio: 'Pelo estúdio',
};

export const PAYMENT_KIND_LABEL: Record<string, string> = {
  payment: 'Pagamento',
  reversal: 'Estorno',
  refund: 'Devolução',
};

export type BadgeTone = 'warning' | 'destructive' | 'success' | 'outline';

export interface DerivedBadge {
  label: string;
  tone: BadgeTone;
}

type DerivedSource = Pick<
  ContractData,
  | 'status'
  | 'depositPending'
  | 'balanceDueSoon'
  | 'balanceOverdue'
  | 'settled'
  | 'needsAcceptance'
  | 'daysToBalanceDue'
>;

export function derivedBadges(c: DerivedSource): DerivedBadge[] {
  if (c.status === 'cancelled') return [];
  const out: DerivedBadge[] = [];
  if (Number(c.depositPending) > 0) out.push({ label: 'Entrada pendente', tone: 'warning' });
  if (c.balanceDueSoon) {
    const n = c.daysToBalanceDue;
    out.push({ label: `Vence em ${n} ${n === 1 ? 'dia' : 'dias'}`, tone: 'warning' });
  }
  if (c.balanceOverdue) out.push({ label: 'Vencido', tone: 'destructive' });
  if (c.settled) out.push({ label: 'Quitado', tone: 'success' });
  if (c.needsAcceptance) out.push({ label: 'Aguardando aceite', tone: 'outline' });
  return out;
}

export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  OVERPAYMENT: 'O valor ultrapassa o saldo do contrato.',
  ALREADY_REVERSED: 'Este pagamento já foi estornado.',
  REFUND_METHOD_REQUIRED: 'Informe o método da devolução.',
  MEMBER_NOT_COVERED: 'Esta pessoa não está coberta pelo contrato.',
  GROUP_HAS_CONTRACT: 'Este grupo já possui um contrato ativo.',
  TOTAL_BELOW_PAID: 'O novo total ficaria abaixo do que já foi pago.',
  UNKNOWN_TEMPLATE_VARIABLE: 'O modelo usa uma variável desconhecida.',
  ALREADY_ACCEPTED: 'Este contrato já foi aceito nesta versão.',
  PAYMENT_MODE_INVALID: 'Forma de pagamento inválida.',
  INSTALLMENTS_REQUIRED: 'Informe ao menos uma parcela do sinal.',
  INSTALLMENTS_COUNT_INVALID: 'Quantidade de parcelas inválida para a forma de pagamento.',
  INSTALLMENT_INVALID: 'Toda parcela precisa de valor maior que zero e data.',
  INSTALLMENTS_SUM_MISMATCH: 'A soma das parcelas deve ser igual ao valor do sinal.',
  A_VISTA_MUST_EQUAL_TOTAL: 'No pagamento à vista, a entrada é o valor total.',
  PACKAGE_ITEM_WITHOUT_PACKAGE: 'Há item marcado como do pacote, mas o contrato não tem pacote.',
  INVALID_DISCOUNT_DESCRIPTION: 'A descrição do desconto é inválida (máximo de 120 caracteres).',
};

/** Mensagem para um erro do backend; a do servidor é mais específica quando existe. */
export function contractErrorMessage(e: { code: string; message: string }): string {
  if (e.code === 'UNKNOWN_TEMPLATE_VARIABLE' || e.code === 'CONTRACT_INCOMPLETE') return e.message || CONTRACT_ERROR_MESSAGES[e.code];
  return CONTRACT_ERROR_MESSAGES[e.code] ?? e.message;
}

/** "2030-06-15" -> "15/06/2030" sem passar por fuso. */
export function formatDateOnly(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}
