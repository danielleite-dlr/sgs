/**
 * Papel de sistema "Assistente" (Fase 11, gap G-01): quem só acompanha noiva/debutante.
 * Módulo puro (sem Nest/Prisma client).
 */
export const ASSISTANT_ROLE_NAME = 'ASSISTANT' as const;

/** Fragmento de where do Prisma para Member: exclui o papel Assistente. */
export const NOT_ASSISTANT_ROLE_WHERE = {
  role: { name: { not: ASSISTANT_ROLE_NAME } },
} as const;

export function isAssistantRole(roleName: string | null | undefined): boolean {
  return roleName === ASSISTANT_ROLE_NAME;
}

/** true quando há memberships e TODAS são ASSISTANT. */
export function onlyAssistantMemberships(
  ms: ReadonlyArray<{ roleName: string }>,
): boolean {
  return ms.length > 0 && ms.every((m) => m.roleName === ASSISTANT_ROLE_NAME);
}

/** E-mail fictício (nunca recebe nada) para quem não entra no sistema. */
export function fictitiousAssistantEmail(id: string): string {
  return `assistente.${id}@sem-login.invalid`;
}

export const ASSISTANT_NOT_SCHEDULABLE_CODE =
  'PROFESSIONAL_IS_ASSISTANT' as const;

export function assistantNotSchedulableMessage(name: string): string {
  return `${name} é assistente de noiva/debutante e não faz atendimento. Escolha outra profissional.`;
}

export const ASSISTANT_NO_LOGIN_MESSAGE =
  'Assistente não entra no sistema. Se ela precisar de acesso, mude o papel dela em Profissionais.';
