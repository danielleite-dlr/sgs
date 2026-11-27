/**
 * Regras puras de quem ajusta quem e o quê (D-08, D-09, D-15). Sem I/O.
 */
import type { AccessItemDef } from './access-catalog';
import { LOCKED_ROLES, type ResolvedAccess } from './access-resolve';

export interface AdjustError {
  code:
    | 'ACCESS_TARGET_ADMIN'
    | 'ACCESS_TARGET_ASSISTANT'
    | 'ACCESS_TARGET_FORBIDDEN'
    | 'ACCESS_TARGET_SELF';
  message: string;
}

const ADMIN_LOCK: AdjustError = {
  code: 'ACCESS_TARGET_ADMIN',
  message: 'O Administrador sempre tem todos os acessos.',
};

const ASSISTANT_TARGET_LOCK: AdjustError = {
  code: 'ACCESS_TARGET_ASSISTANT',
  message:
    'Assistente não entra no sistema, então não tem acessos para ajustar.',
};

const FORBIDDEN: AdjustError = {
  code: 'ACCESS_TARGET_FORBIDDEN',
  message: 'O Gerente ajusta só Atendentes e Profissionais.',
};

/** Quem pode ajustar quem: null = permitido. */
export function targetLock(a: {
  actorRole: string;
  actorId: string;
  targetRole: string;
  targetId: string;
}): AdjustError | null {
  if (a.actorRole !== 'ADMIN' && a.actorRole !== 'MANAGER') return FORBIDDEN;
  if (a.targetRole === 'ASSISTANT') return ASSISTANT_TARGET_LOCK;
  if (a.targetRole === 'ADMIN') return ADMIN_LOCK;
  if (a.actorRole === 'ADMIN') return null;
  if (a.actorId === a.targetId) {
    return {
      code: 'ACCESS_TARGET_SELF',
      message: 'Ninguém ajusta os próprios acessos.',
    };
  }
  if (a.targetRole === 'ATTENDANT' || a.targetRole === 'PROFESSIONAL') {
    return null;
  }
  return FORBIDDEN;
}

export const NOT_GRANTABLE_MESSAGE =
  'Perfis de acesso fica só com Administrador e Gerente.';
export const EXCEEDS_ACTOR_MESSAGE =
  'Você não tem este acesso, então não pode concedê-lo.';

/**
 * Pode inverter o estado atual do item no alvo? Desligar é sempre permitido;
 * ligar exige `grantable` para papéis travados e, para quem não é ADMIN,
 * o item ligado no próprio ator (D-15).
 */
export function itemAdjustability(
  actor: ResolvedAccess,
  targetRole: string,
  item: AccessItemDef,
  targetEnabled: boolean,
): { adjustable: boolean; lockReason: string | null } {
  if (targetEnabled) return { adjustable: true, lockReason: null };
  if (
    !item.grantable &&
    (LOCKED_ROLES as readonly string[]).includes(targetRole)
  ) {
    return { adjustable: false, lockReason: NOT_GRANTABLE_MESSAGE };
  }
  if (
    actor.roleName !== 'ADMIN' &&
    actor.items.get(item.id)?.enabled !== true
  ) {
    return { adjustable: false, lockReason: EXCEEDS_ACTOR_MESSAGE };
  }
  return { adjustable: true, lockReason: null };
}
