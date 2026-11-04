import { Prisma } from '@prisma/client';

export interface ContractUserError {
  code: string;
  message: string;
  field: string | null;
}

export class ContractError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field: string | null = null,
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

const RANGE_ERRORS: Record<string, ContractUserError> = {
  DISCOUNT_GT_ITEMS: {
    code: 'DISCOUNT_GT_ITEMS',
    message: 'O desconto não pode ser maior que o total dos itens.',
    field: 'discountAmount',
  },
  DEPOSIT_GT_TOTAL: {
    code: 'DEPOSIT_GT_TOTAL',
    message: 'A entrada não pode ser maior que o valor total do contrato.',
    field: 'depositAmount',
  },
  NEGATIVE: {
    code: 'NEGATIVE_AMOUNT',
    message: 'Valores negativos não são permitidos.',
    field: null,
  },
};

const GROUP_HAS_CONTRACT: ContractUserError = {
  code: 'GROUP_HAS_CONTRACT',
  message: 'Este grupo já possui um contrato ativo.',
  field: 'groupId',
};

/** Converte erros de domínio/banco em erro de payload; null = erro inesperado (relançar). */
export function mapContractError(e: unknown): ContractUserError | null {
  if (e instanceof ContractError) {
    return { code: e.code, message: e.message, field: e.field };
  }
  if (e instanceof RangeError && RANGE_ERRORS[e.message]) {
    return RANGE_ERRORS[e.message];
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return GROUP_HAS_CONTRACT;
  }
  if (e instanceof Error && /uq_contracts_group_live/.test(e.message)) {
    return GROUP_HAS_CONTRACT;
  }
  return null;
}
