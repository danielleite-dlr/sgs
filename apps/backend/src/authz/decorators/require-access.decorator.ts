import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ACCESS_KEY = 'requiredAccess';

/**
 * Exige que a pessoa tenha ao menos um dos itens de acesso (ids do access-catalog)
 * ou porteiros nomeados (ACCESS_GATES) ligados — OU entre eles.
 * Método sobrescreve classe.
 */
export const RequireAccess = (...itemsOrGates: string[]) =>
  SetMetadata(REQUIRED_ACCESS_KEY, itemsOrGates);
