import type { TenantPrismaClient } from '../../database/types';

export const DEFAULT_BRIDAL_ASSISTANT_DAILY_RATE = '220.00';

/** Diária vigente da assistente da noiva (D-06); sem linha em contract_settings = 220.00. */
export async function loadBridalAssistantDailyRate(tx: TenantPrismaClient): Promise<string> {
  const row = await tx.contractSettings.findFirst({
    select: { bridalAssistantDailyRate: true },
  });
  return row ? row.bridalAssistantDailyRate.toFixed(2) : DEFAULT_BRIDAL_ASSISTANT_DAILY_RATE;
}

/** Grava a diária (upsert em contract_settings); não altera vínculos já feitos (D-08). */
export async function saveBridalAssistantDailyRate(
  tx: TenantPrismaClient,
  orgId: string,
  memberId: string,
  rate: string,
): Promise<string> {
  const row = await tx.contractSettings.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, bridalAssistantDailyRate: rate, updatedBy: memberId },
    update: { bridalAssistantDailyRate: rate, updatedBy: memberId },
    select: { bridalAssistantDailyRate: true },
  });
  return row.bridalAssistantDailyRate.toFixed(2);
}
