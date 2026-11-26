import { adminPrisma } from '../setup';

/** Fase 11 D-02: marca/desmarca "atende noiva/debutante" direto no banco (sem passar pela API). */
export async function markServesBridal(memberIds: string[], on = true): Promise<void> {
  await adminPrisma.member.updateMany({
    where: { id: { in: memberIds } },
    data: { servesBridal: on },
  });
}

/** Fase 11 D-01: marca/desmarca "fixa (equipe do studio)" direto no banco. */
export async function markFixed(memberIds: string[], on = true): Promise<void> {
  await adminPrisma.member.updateMany({
    where: { id: { in: memberIds } },
    data: { isFixed: on },
  });
}
