import type { TenantPrismaClient } from '../database/types';
import { BridalError } from './bridal-errors';

export interface BridalPersonRef {
  clientId?: string | null;
  newClient?: { fullName: string; phone?: string | null } | null;
}

/** Resolve o cliente de uma pessoa do grupo: existente ativo ou cliente mínima (nome + telefone). */
export async function resolvePersonClientTx(
  tx: TenantPrismaClient,
  orgId: string,
  person: BridalPersonRef,
): Promise<string> {
  const hasClient = !!person.clientId;
  const hasNew = !!person.newClient;
  if (hasClient === hasNew) {
    throw new BridalError(
      'CLIENT_REQUIRED',
      'Escolha uma cliente ou cadastre uma nova.',
      'clientId',
    );
  }
  if (person.clientId) {
    const found = await tx.client.findFirst({
      where: { id: person.clientId, deletedAt: null },
      select: { id: true },
    });
    if (!found) {
      throw new BridalError('CLIENT_NOT_FOUND', 'Cliente não encontrada.', 'clientId');
    }
    return found.id;
  }
  const nc = person.newClient!;
  const fullName = nc.fullName?.trim() ?? '';
  if (fullName.length < 2 || fullName.length > 255) {
    throw new BridalError('INVALID_NAME', 'Informe o nome da cliente.', 'newClient.fullName');
  }
  const phone = nc.phone?.trim() || null;
  if (phone && phone.length > 30) {
    throw new BridalError('INVALID_PHONE', 'Telefone inválido.', 'newClient.phone');
  }
  const created = await tx.client.create({
    data: { organizationId: orgId, fullName, phone },
    select: { id: true },
  });
  return created.id;
}
