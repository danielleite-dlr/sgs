/**
 * Regras puras da assistente da noiva (fase 09.1). Sem Prisma/Nest: só dados
 * já carregados entram, para poder testar isolado.
 */

/** Tipo do bloqueio de agenda da assistente ("acompanhamento"). */
export const BRIDAL_ASSISTANT_BLOCK_KIND = 'acompanhamento' as const;

export type AssistantGroupLike = {
  eventKind: string;
  locationKind: string;
  status: string;
  pkg: { includesBridalAssistant: boolean; deletedAt: Date | null } | null;
};

/**
 * Motivo de o grupo não ter assistente, ou null quando é elegível (D-03).
 * Ordem de checagem: status, tipo de evento, local, pacote.
 */
export function assistantIneligibilityReason(g: AssistantGroupLike): string | null {
  if (g.status !== 'active') return 'o grupo não está ativo';
  if (g.eventKind !== 'noiva') return 'só noivas têm assistente';
  if (g.locationKind !== 'studio') return 'evento fora do estúdio';
  if (!g.pkg || g.pkg.deletedAt || !g.pkg.includesBridalAssistant) {
    return 'o pacote não inclui assistente da noiva';
  }
  return null;
}

/** D-03: noiva + estúdio + grupo ativo + pacote (não excluído) com assistente. */
export function isAssistantEligible(g: AssistantGroupLike): boolean {
  return assistantIneligibilityReason(g) === null;
}

/**
 * D-17: pendente = elegível, sem assistente definida, evento hoje ou futuro
 * (datas "YYYY-MM-DD" no fuso da org, comparação lexicográfica) e comanda do
 * dia da noiva ainda não fechada.
 */
export function isAssistantPending(
  input: AssistantGroupLike & {
    assistantMemberId: string | null;
    eventDateYmd: string;
    todayYmd: string;
    eventComandaClosed: boolean;
  },
): boolean {
  if (!isAssistantEligible(input)) return false;
  if (input.assistantMemberId) return false;
  if (input.eventComandaClosed) return false;
  return input.eventDateYmd >= input.todayYmd;
}

/** Nota do bloqueio de agenda da assistente. */
export function assistantBlockNote(brideName: string): string {
  return `Acompanhando noiva ${brideName}`;
}

/** Nome do item de repasse (diária) da assistente. */
export function assistantAccrualItemName(groupName: string): string {
  return `Assistente da Noiva — ${groupName}`;
}
