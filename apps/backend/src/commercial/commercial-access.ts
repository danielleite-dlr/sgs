/**
 * Regras de acesso do Comercial (D-12, D-20, D-21). Único ponto de decisão:
 * todo serviço importa daqui, nenhum compara papel por conta própria.
 */

export const COMMERCIAL_ROLES = ['ADMIN', 'MANAGER', 'ATTENDANT'] as const;

export const isManagerRole = (r: string | null | undefined): boolean =>
  r === 'ADMIN' || r === 'MANAGER';

export const canUseCommercial = (r: string | null | undefined): boolean =>
  !!r && (COMMERCIAL_ROLES as readonly string[]).includes(r);

/**
 * D-21 (confirmada pela usuária em 2026-11-18): quem marca ganho: todos os papéis do
 * Comercial, nos negócios que veem. Para "só admin/gerente", trocar para ['ADMIN', 'MANAGER']
 * aqui e em apps/frontend/src/features/commercial/commercial-permissions.ts (WIN_DEAL_ROLES).
 */
export const WIN_DEAL_ROLES: readonly string[] = ['ADMIN', 'MANAGER', 'ATTENDANT'];

export const canWinDeal = (r: string | null | undefined): boolean =>
  !!r && WIN_DEAL_ROLES.includes(r);

export interface CommercialViewer {
  roleName: string;
  memberId: string;
}

// Record<string, unknown> por enquanto: o 09-04 pode estreitar para Prisma.*WhereInput.
export interface CommercialVisibility {
  deal: Record<string, unknown>;
  lead: Record<string, unknown>;
  interaction: Record<string, unknown>;
  reminder: Record<string, unknown>;
}

/**
 * Filtros de visibilidade por papel.
 * ADMIN/MANAGER veem tudo (não excluído). ATTENDANT vê negócios em que é responsável e
 * leads criados por ela ou com negócio dela; negócio sem responsável fica só para gestão.
 */
export function visibilityWhere(v: CommercialViewer): CommercialVisibility {
  if (isManagerRole(v.roleName)) {
    return {
      deal: { deletedAt: null },
      lead: { deletedAt: null },
      interaction: { lead: { deletedAt: null } },
      reminder: {},
    };
  }
  if (v.roleName === 'ATTENDANT') {
    const me = v.memberId;
    const lead = {
      deletedAt: null,
      OR: [{ createdBy: me }, { deals: { some: { assigneeMemberId: me, deletedAt: null } } }],
    };
    return {
      deal: { deletedAt: null, assigneeMemberId: me },
      lead,
      interaction: { lead },
      reminder: {
        OR: [{ createdBy: me }, { deal: { assigneeMemberId: me, deletedAt: null } }],
      },
    };
  }
  // Defesa: o resolver já barra quem não usa o Comercial.
  throw new Error('FORBIDDEN');
}
