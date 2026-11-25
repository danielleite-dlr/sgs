import { GraphQLError } from 'graphql';

export const ACCESS_DENIED_CODE = 'ACCESS_DENIED';

/**
 * Recusa por área desligada ou permissão faltante. Code próprio: o frontend NÃO
 * desloga a pessoa (só FORBIDDEN/UNAUTHENTICATED derrubam a sessão). A mensagem
 * mantém o prefixo "FORBIDDEN:" porque testes e logs casam /FORBIDDEN/.
 */
export class AccessDeniedError extends GraphQLError {
  constructor(
    message: string,
    extra?: { reason?: string; items?: string[]; missing?: string[] },
  ) {
    super(message, { extensions: { code: ACCESS_DENIED_CODE, ...extra } });
  }
}
