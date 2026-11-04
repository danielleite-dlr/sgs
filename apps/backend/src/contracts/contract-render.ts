import { toCents } from '../common/money';
import type { TenantPrismaClient } from '../database/types';
import { ContractError } from './contract-errors';
import { loadEffectiveSettings } from './contract-settings.service';
import {
  formatBRL,
  formatDateBR,
  renderContract,
  sha256Hex,
  type TemplateVariable,
} from './domain/contract-template';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function formatCpf(cpf: string | null): string {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return 'não informado';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Renderiza o texto do contrato a partir do estado atual (itens, totais, snapshot da
 * política) e grava uma nova `contract_versions` (version = current_version + 1) com o
 * sha256 do texto. O chamador deve ter travado o contrato (FOR UPDATE).
 */
export async function renderContractVersionTx(
  tx: TenantPrismaClient,
  orgId: string,
  contractId: string,
  memberId: string,
): Promise<{ versionId: string; version: number; sha256: string }> {
  const c = await tx.contract.findUnique({
    where: { id: contractId },
    include: {
      group: true,
      bride: { select: { fullName: true, cpf: true } },
      items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { member: { include: { client: { select: { fullName: true } } } } },
      },
    },
  });
  if (!c) throw new ContractError('NOT_FOUND', 'Contrato não encontrado.', 'id');
  const settings = await loadEffectiveSettings(tx, orgId);

  const lines = c.items.map((it) => {
    const label = it.member.relationLabel ?? (it.member.role === 'bride' ? 'Noiva' : 'Acompanhante');
    const trial = it.purpose === 'trial' ? ' (teste)' : '';
    const qty = it.quantity > 1 ? ` x${it.quantity}` : '';
    return `- ${it.member.client.fullName} (${label}): ${it.descriptionSnapshot}${trial}${qty} — ${formatBRL(toCents(it.total))}`;
  });
  const discountCents = toCents(c.discountAmount);
  if (discountCents > 0) lines.push(`- Desconto: -${formatBRL(discountCents)}`);

  const policy = c.cancellationPolicy as { clause?: string } | null;
  const vars: Record<TemplateVariable, string> = {
    noiva_nome: c.bride.fullName,
    noiva_cpf: formatCpf(c.bride.cpf),
    evento_data: formatDateBR(isoDate(c.group.eventDate)),
    evento_local:
      c.group.locationKind === 'external' ? (c.group.locationAddress ?? '') : 'No estúdio',
    itens: lines.join('\n'),
    valor_total: formatBRL(toCents(c.totalAmount)),
    entrada: formatBRL(toCents(c.depositAmount)),
    prazo_restante: formatDateBR(isoDate(c.balanceDueDate)),
    politica_cancelamento: policy?.clause ?? '',
  };
  const text = renderContract(settings.templateBody, vars);
  const sha256 = sha256Hex(text);
  const version = c.currentVersion + 1;

  const row = await tx.contractVersion.create({
    data: {
      organizationId: orgId,
      contractId,
      version,
      renderedText: text,
      textSha256: sha256,
      createdBy: memberId,
    },
  });
  await tx.contract.update({ where: { id: contractId }, data: { currentVersion: version } });
  return { versionId: row.id, version, sha256 };
}
