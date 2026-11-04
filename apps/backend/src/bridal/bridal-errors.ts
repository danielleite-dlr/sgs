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

function uniqueViolation(e: unknown): string {
  const err = e as { code?: string; meta?: unknown; message?: string };
  if (err?.code !== 'P2002') return '';
  return `${JSON.stringify(err.meta ?? {})} ${err.message ?? ''}`;
}

export function mapBridalError(e: unknown): BridalUserError | null {
  if (e instanceof BridalError) {
    return { code: e.code, message: e.message, field: e.field };
  }
  const c = uniqueViolation(e);
  if (c) {
    if (c.includes('uq_bgm_one_bride')) {
      return {
        code: 'BRIDE_ALREADY_SET',
        message: 'Este grupo já tem uma noiva.',
        field: null,
      };
    }
    if (c.includes('uq_bgm_group_client') || c.includes('group_id')) {
      return {
        code: 'MEMBER_ALREADY_IN_GROUP',
        message: 'Esta cliente já faz parte do grupo.',
        field: 'clientId',
      };
    }
  }
  return mapSchedulingError(e);
}
