import type { TenantPrismaClient } from '../database/types';

export function formatContractCode(year: number, n: number): string {
  return `CT-${year}-${String(n).padStart(3, '0')}`;
}

/**
 * Próximo código CT-AAAA-NNN da organização para o `year` dado (ano do evento).
 * UPSERT atômico em contract_sequences: a linha fica travada até o commit, então
 * a numeração é contígua e sem duplicata sob concorrência; rollback devolve o número.
 */
export async function nextContractCode(
  tx: TenantPrismaClient,
  orgId: string,
  year: number,
): Promise<string> {
  const [{ last_value }] = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO contract_sequences (organization_id, year, last_value)
    VALUES (${orgId}::uuid, ${year}, 1)
    ON CONFLICT (organization_id, year)
    DO UPDATE SET last_value = contract_sequences.last_value + 1
    RETURNING last_value`;
  return formatContractCode(year, last_value);
}
