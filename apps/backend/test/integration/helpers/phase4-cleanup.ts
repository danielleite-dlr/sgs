import { adminPrisma } from '../setup';

/**
 * Remove as linhas da Fase 4 (grupos de noivas, contratos, ledgers, sugestoes de IA)
 * das organizacoes retornadas por `orgFilterSql` (um SELECT de ids; constante do proprio teste).
 * Usa adminPrisma (sgs_migrator): unico papel com DELETE nos ledgers contract_*.
 * Deve rodar ANTES do cleanup da Fase 3 (clientes, servicos, pacotes, membros).
 */
export async function deletePhase4Rows(orgFilterSql: string): Promise<void> {
  const org = `organization_id IN (${orgFilterSql})`;
  const statements = [
    `DELETE FROM notifications WHERE ${org} AND (kind LIKE 'contract_%' OR kind LIKE 'bridal_%')`,
    `DELETE FROM contract_alert_runs WHERE ${org}`,
    `DELETE FROM ai_schedule_suggestions WHERE ${org}`,
    `DELETE FROM contract_acceptances WHERE ${org}`,
    `DELETE FROM contract_access_tokens WHERE ${org}`,
    `DELETE FROM cash_movements WHERE ${org} AND contract_id IS NOT NULL`,
    `UPDATE comanda_items SET contract_id = NULL WHERE ${org} AND contract_id IS NOT NULL`,
    `UPDATE appointments SET contract_id = NULL, bridal_group_id = NULL WHERE ${org} AND (contract_id IS NOT NULL OR bridal_group_id IS NOT NULL)`,
    `DELETE FROM contract_payments WHERE ${org} AND reverses_payment_id IS NOT NULL`,
    `DELETE FROM contract_payments WHERE ${org}`,
    `DELETE FROM contract_versions WHERE ${org}`,
    `DELETE FROM contract_items WHERE ${org}`,
    `DELETE FROM contracts WHERE ${org}`,
    `DELETE FROM contract_sequences WHERE ${org}`,
    `DELETE FROM time_blocks WHERE ${org} AND bridal_group_id IS NOT NULL`,
    `DELETE FROM bridal_member_services WHERE ${org}`,
    `DELETE FROM bridal_group_members WHERE ${org}`,
    `DELETE FROM bridal_groups WHERE ${org}`,
    `DELETE FROM contract_settings WHERE ${org}`,
  ];
  for (const sql of statements) {
    await adminPrisma.$executeRawUnsafe(sql);
  }
}
