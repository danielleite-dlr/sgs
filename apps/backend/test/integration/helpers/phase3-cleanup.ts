import { adminPrisma } from '../setup';

/**
 * Remove as linhas da Fase 3 (comandas, ledgers, bloqueios) das organizacoes
 * retornadas por `orgFilterSql` (um SELECT de ids; constante do proprio teste).
 * Usa adminPrisma (sgs_migrator), unico papel com DELETE nos ledgers.
 * Deve rodar ANTES de apagar appointments/clients/members/products.
 */
export async function deletePhase3Rows(orgFilterSql: string): Promise<void> {
  const org = `organization_id IN (${orgFilterSql})`;
  const statements = [
    `DELETE FROM commission_records WHERE ${org}`,
    `DELETE FROM audit_log WHERE ${org}`,
    `DELETE FROM cash_movements WHERE ${org}`,
    `DELETE FROM client_credit_movements WHERE ${org}`,
    `DELETE FROM comanda_payments WHERE ${org}`,
    `DELETE FROM comanda_items WHERE ${org}`,
    `UPDATE stock_movements SET comanda_id = NULL WHERE ${org}`,
    `UPDATE appointments SET comanda_id = NULL WHERE ${org}`,
    `DELETE FROM comandas WHERE ${org}`,
    `DELETE FROM comanda_sequences WHERE ${org}`,
    `DELETE FROM time_blocks WHERE ${org}`,
  ];
  for (const sql of statements) {
    await adminPrisma.$executeRawUnsafe(sql);
  }
}
