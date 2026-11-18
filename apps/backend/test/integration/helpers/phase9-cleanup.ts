import { adminPrisma } from '../setup';

/**
 * Remove as linhas da Fase 9 (Comercial) das organizações retornadas por
 * `orgFilterSql` (um SELECT de ids; constante do próprio teste).
 * As etapas (commercial_stages) NÃO são apagadas aqui: ficam até a org sumir,
 * e `destroyPhase9World` as remove antes de `destroyPhase4World`.
 * Deve rodar ANTES do cleanup da Fase 4 (FK para organizations).
 */
export async function deletePhase9Rows(orgFilterSql: string): Promise<void> {
  const org = `organization_id IN (${orgFilterSql})`;
  const statements = [
    `DELETE FROM commercial_reminders WHERE ${org}`,
    `DELETE FROM commercial_interactions WHERE ${org}`,
    `DELETE FROM commercial_deals WHERE ${org}`,
    `DELETE FROM commercial_leads WHERE ${org}`,
    `DELETE FROM commercial_form_settings WHERE ${org}`,
  ];
  for (const sql of statements) {
    await adminPrisma.$executeRawUnsafe(sql);
  }
}
