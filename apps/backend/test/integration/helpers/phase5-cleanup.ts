import { adminPrisma } from '../setup';

/**
 * Remove as linhas da Fase 5 (despesas fixas) das organizacoes retornadas por
 * `orgFilterSql` (um SELECT de ids; constante do proprio teste).
 * Deve rodar ANTES de `destroyPhase4World` (FK para organizations).
 */
export async function deletePhase5Rows(orgFilterSql: string): Promise<void> {
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM package_cost_items WHERE organization_id IN (${orgFilterSql})`,
  );
  await adminPrisma.$executeRawUnsafe(
    `DELETE FROM fixed_expenses WHERE organization_id IN (${orgFilterSql})`,
  );
}
