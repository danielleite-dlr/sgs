/** Papel "Assistente" (fase 11, gap G-01): só acompanha noiva/debutante no estúdio, não entra no sistema. */
export const ASSISTANT_ROLE = 'ASSISTANT' as const;

export function isAssistantRole(roleName: string | null | undefined): boolean {
  return roleName === ASSISTANT_ROLE;
}
