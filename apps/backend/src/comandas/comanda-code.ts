import type { TenantPrismaClient } from '../database/types';

export function formatComandaCode(year: number, n: number): string {
  return `C-${year}-${String(n).padStart(3, '0')}`;
}

/**
 * Próximo código C-AAAA-NNN da organização. O ano é o do fuso da org (uma
 * comanda aberta às 23h30 de 31/12 em São Paulo ainda é do ano que termina).
 * O contador é uma linha por (org, ano) incrementada com UPSERT atômico: a
 * linha fica travada até o commit, então a numeração é contígua e sem
 * duplicata sob concorrência — e um rollback devolve o número (sem buraco).
 */
export async function nextComandaCode(
  tx: TenantPrismaClient,
  orgId: string,
  now: Date = new Date(),
): Promise<string> {
  const org = await tx.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  const timezone = org?.timezone ?? 'America/Sao_Paulo';
  const [{ y }] = await tx.$queryRaw<{ y: number }[]>`
    SELECT EXTRACT(YEAR FROM (${now}::timestamptz AT TIME ZONE ${timezone}))::int AS y`;
  const [{ last_value }] = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO comanda_sequences (organization_id, year, last_value)
    VALUES (${orgId}::uuid, ${y}, 1)
    ON CONFLICT (organization_id, year)
    DO UPDATE SET last_value = comanda_sequences.last_value + 1
    RETURNING last_value`;
  return formatComandaCode(y, last_value);
}
