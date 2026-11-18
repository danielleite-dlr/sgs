/**
 * Erros do domínio Comercial. Códigos usados na fase: NOT_FOUND, FORBIDDEN_ROLE,
 * STAGE_SYSTEM, STAGE_NOT_EMPTY, STAGE_ORDER, STAGE_LAST_OPEN, COLOR_INVALID, SLA_INVALID,
 * NAME_REQUIRED, CONTACT_REQUIRED, PHONE_INVALID, EMAIL_INVALID, ASSIGNEE_INVALID,
 * DEAL_CLOSED, PACKAGE_REQUIRED, LOST_REASON_REQUIRED, WIN_NOT_ALLOWED.
 */
export interface CommercialUserError {
  code: string;
  message: string;
  field: string | null;
}

export class CommercialError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly field: string | null = null,
  ) {
    super(message);
    this.name = 'CommercialError';
  }
}

export function mapCommercialError(e: unknown): CommercialUserError | null {
  if (e instanceof CommercialError) {
    return { code: e.code, message: e.message, field: e.field };
  }
  return null;
}
