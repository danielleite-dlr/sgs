import type { Client } from '@prisma/client';
import type { TenantPrismaClient } from '../database/types';
import { normalizeCpf, validateCpf } from './cpf.util';
import { CreateClientInput, UpdateClientInput } from './dto/client.input';

/**
 * Regras de cliente compartilhadas entre ClientsService e o ganho do Comercial (fase 9).
 * As funções *Tx gravam no `tx` de quem chama e lançam ClientFieldError; o rollback é de quem chama.
 */
const RG_RE = /^[0-9Xx.\-\s]{5,20}$/;
const PHONE_RE = /^[\d\s()+\-]{8,30}$/;

export class ClientFieldError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly field: string | null = null,
  ) {
    super(message);
    this.name = 'ClientFieldError';
  }
}

export interface ClientFieldProblem {
  code: string;
  message: string;
  field: string | null;
}

export function emptyToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function normalizeCep(v: string | null | undefined): string | null {
  const t = emptyToNull(v);
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

type ClientFields = Pick<
  CreateClientInput,
  'phone' | 'email' | 'cpf' | 'rg' | 'postalCode' | 'phone2' | 'phone3'
>;

/**
 * Valida os campos; devolve o primeiro problema ou null.
 * `create` exige telefone ou e-mail; no `update` essa checagem depende do registro atual
 * e fica em updateClientTx.
 */
export function validateClientFields(
  input: ClientFields,
  mode: 'create' | 'update',
): ClientFieldProblem | null {
  if (mode === 'create' && !input.phone && !input.email) {
    return {
      code: 'CONTACT_REQUIRED',
      message: 'Informe pelo menos um telefone ou e-mail.',
      field: null,
    };
  }
  if (input.cpf && !validateCpf(input.cpf)) {
    return {
      code: 'CPF_INVALID',
      message: mode === 'create' ? 'CPF inválido. Verifique os números.' : 'CPF inválido.',
      field: 'cpf',
    };
  }
  if (input.rg && !RG_RE.test(input.rg)) {
    return { code: 'RG_INVALID', message: 'RG inválido.', field: 'rg' };
  }
  if (input.postalCode && !/^\d{5}-?\d{3}$/.test(input.postalCode)) {
    return { code: 'POSTAL_CODE_INVALID', message: 'CEP inválido.', field: 'postalCode' };
  }
  for (const f of ['phone2', 'phone3'] as const) {
    const v = input[f];
    if (v && !PHONE_RE.test(v)) {
      return { code: 'PHONE_INVALID', message: 'Telefone inválido.', field: f };
    }
  }
  return null;
}

function throwIfProblem(p: ClientFieldProblem | null): void {
  if (p) throw new ClientFieldError(p.code, p.message, p.field);
}

export async function createClientTx(
  tx: TenantPrismaClient,
  orgId: string,
  input: CreateClientInput,
): Promise<Client> {
  throwIfProblem(validateClientFields(input, 'create'));
  return tx.client.create({
    data: {
      organizationId: orgId,
      fullName: input.fullName,
      phone: input.phone ?? null,
      email: input.email?.toLowerCase() ?? null,
      cpf: input.cpf ? normalizeCpf(input.cpf) : null,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      address: input.address ?? null,
      rg: emptyToNull(input.rg)?.toUpperCase() ?? null,
      postalCode: normalizeCep(input.postalCode),
      phone2: emptyToNull(input.phone2),
      phone3: emptyToNull(input.phone3),
      notes: input.notes ?? null,
    },
  });
}

export async function updateClientTx(
  tx: TenantPrismaClient,
  _orgId: string,
  input: UpdateClientInput,
): Promise<Client> {
  throwIfProblem(validateClientFields(input, 'update'));
  const existing = await tx.client.findFirst({
    where: { id: input.id, deletedAt: null },
  });
  if (!existing) throw new ClientFieldError('NOT_FOUND', 'Cliente não encontrado.');

  const phone = input.phone !== undefined ? input.phone : existing.phone;
  const email = input.email !== undefined ? (input.email?.toLowerCase() ?? null) : existing.email;
  if (!phone && !email) {
    throw new ClientFieldError('CONTACT_REQUIRED', 'Informe pelo menos um telefone ou e-mail.');
  }

  return tx.client.update({
    where: { id: input.id },
    data: {
      fullName: input.fullName ?? existing.fullName,
      phone,
      email,
      cpf: input.cpf !== undefined ? (input.cpf ? normalizeCpf(input.cpf) : null) : existing.cpf,
      birthDate:
        input.birthDate !== undefined
          ? input.birthDate
            ? new Date(input.birthDate)
            : null
          : existing.birthDate,
      address: input.address !== undefined ? input.address : existing.address,
      rg: input.rg !== undefined ? (emptyToNull(input.rg)?.toUpperCase() ?? null) : existing.rg,
      postalCode:
        input.postalCode !== undefined ? normalizeCep(input.postalCode) : existing.postalCode,
      phone2: input.phone2 !== undefined ? emptyToNull(input.phone2) : existing.phone2,
      phone3: input.phone3 !== undefined ? emptyToNull(input.phone3) : existing.phone3,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      version: { increment: 1 },
    },
  });
}
