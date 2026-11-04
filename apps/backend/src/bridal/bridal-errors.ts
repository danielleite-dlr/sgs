import { mapSchedulingError } from '../appointments/scheduling-guard';

/** Erro de regra de negócio do grupo de noivas; lançado dentro da transação (ROLLBACK). */
export class BridalError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field: string | null = null,
  ) {
    super(message);
  }
}

export interface BridalUserError {
  code: string;
  message: string;
  field: string | null;
}

function uniqueTarget(e: unknown): string[] | null {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== 'P2002') return null;
  const t = err.meta?.target;
  if (Array.isArray(t)) return t.map(String);
  return typeof t === 'string' ? [t] : [];
}

export function mapBridalError(e: unknown): BridalUserError | null {
  if (e instanceof BridalError) {
    return { code: e.code, message: e.message, field: e.field };
  }
  const target = uniqueTarget(e);
  if (target) {
    // uq_bgm_one_bride é índice parcial: o Prisma reporta só (group_id).
    if (target.includes('uq_bgm_one_bride') || (target.length === 1 && target[0] === 'group_id')) {
      return {
        code: 'BRIDE_ALREADY_SET',
        message: 'Este grupo já tem uma noiva.',
        field: null,
      };
    }
    if (target.includes('uq_bgm_group_client') || target.includes('client_id')) {
      return {
        code: 'MEMBER_ALREADY_IN_GROUP',
        message: 'Esta cliente já faz parte do grupo.',
        field: 'clientId',
      };
    }
  }
  return mapSchedulingError(e);
}
