import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../database/tenant-context.service';
import { normalizeCpf } from './cpf.util';
import {
  ClientFieldError,
  createClientTx,
  updateClientTx,
  validateClientFields,
} from './client-tx';
import { CreateClientInput, UpdateClientInput } from './dto/client.input';

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

const errPayload = (code: string, message: string, field?: string) => ({
  client: null,
  errors: [{ code, message, field: field ?? null }] as UserError[],
});

/**
 * ClientsService — CRUD for client profiles (CLI-01).
 *
 * Business rules:
 *   - createClient requires fullName + at least one of (phone, email)
 *   - CPF is optional; when provided, must pass Brazilian checksum validation
 *   - CPF is stored and looked up in normalized (digits-only) form
 *   - Duplicate CPF/phone/email is NOT blocked — clientsByField supports
 *     the UI showing duplicates before the attendant decides (D-22)
 *   - clientHistory returns [] in Phase 2; Phase 3 aggregates appointments/comandas
 *
 * All DB ops are wrapped in runWithTenant (RLS enforced by PostgreSQL).
 */
@Injectable()
export class ClientsService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(
    orgId: string,
    opts: { search?: string; limit?: number; offset?: number } = {},
  ) {
    const limit = Math.min(opts.limit ?? 20, 100);
    const offset = opts.offset ?? 0;
    const search = opts.search?.trim();

    return this.tenant.runWithTenant(orgId, async (tx) => {
      const where: Prisma.ClientWhereInput = { deletedAt: null };

      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
          { cpf: { contains: normalizeCpf(search) } },
        ];
      }

      const [rows, totalCount] = await Promise.all([
        tx.client.findMany({
          where,
          orderBy: { fullName: 'asc' },
          take: limit,
          skip: offset,
        }),
        tx.client.count({ where }),
      ]);

      return { rows, totalCount };
    });
  }

  async byId(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.client.findFirst({ where: { id, deletedAt: null } }),
    );
  }

  async byField(
    orgId: string,
    f: {
      cpf?: string;
      phone?: string;
      email?: string;
      excludeId?: string;
    },
  ) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const conditions: Prisma.ClientWhereInput[] = [];
      if (f.cpf) conditions.push({ cpf: normalizeCpf(f.cpf) });
      if (f.phone) conditions.push({ phone: f.phone });
      if (f.email) conditions.push({ email: f.email.toLowerCase() });
      if (conditions.length === 0) return [];

      return tx.client.findMany({
        where: {
          deletedAt: null,
          OR: conditions,
          ...(f.excludeId ? { NOT: { id: f.excludeId } } : {}),
        },
        take: 10,
      });
    });
  }

  async create(orgId: string, input: CreateClientInput) {
    const problem = validateClientFields(input, 'create');
    if (problem) return errPayload(problem.code, problem.message, problem.field ?? undefined);

    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const client = await createClientTx(tx, orgId, input);
        return { client, errors: [] as UserError[] };
      });
    } catch (e) {
      if (e instanceof ClientFieldError) {
        return errPayload(e.code, e.message, e.field ?? undefined);
      }
      throw e;
    }
  }

  async update(orgId: string, input: UpdateClientInput) {
    const problem = validateClientFields(input, 'update');
    if (problem) return errPayload(problem.code, problem.message, problem.field ?? undefined);

    try {
      return await this.tenant.runWithTenant(orgId, async (tx) => {
        const client = await updateClientTx(tx, orgId, input);
        return { client, errors: [] as UserError[] };
      });
    } catch (e) {
      if (e instanceof ClientFieldError) {
        return errPayload(e.code, e.message, e.field ?? undefined);
      }
      throw e;
    }
  }

  async softDelete(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.client.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) return errPayload('NOT_FOUND', 'Cliente não encontrado.');

      const client = await tx.client.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { client, errors: [] as UserError[] };
    });
  }

  async restore(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.client.findFirst({
        where: { id, deletedAt: { not: null } },
      });
      if (!existing) {
        return errPayload('NOT_FOUND', 'Cliente não encontrado ou já ativo.');
      }

      const client = await tx.client.update({
        where: { id },
        data: { deletedAt: null },
      });
      return { client, errors: [] as UserError[] };
    });
  }

  /**
   * Phase 2 stub per D-23/D-24.
   * Phase 3 will aggregate appointments + comandas into this query.
   * The resolver is gated by CLIENT_READ so the slot is available immediately.
   */
  async history(
    orgId: string,
    clientId: string,
    _filters?: {
      fromDate?: Date;
      toDate?: Date;
      professionalId?: string;
      kind?: string;
    },
  ) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      // Verify client exists within this org (RLS ensures org scope)
      const c = await tx.client.findFirst({
        where: { id: clientId, deletedAt: null },
      });
      if (!c) return [];
      // Phase 2 stub — returns empty array; Phase 3 replaces with real aggregation
      return [] as Array<{
        id: string;
        occurredAt: Date;
        kind: string;
        description: string;
        amount: string | null;
        professionalName: string | null;
      }>;
    });
  }
}
