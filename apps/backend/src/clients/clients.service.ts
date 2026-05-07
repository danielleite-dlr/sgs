import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../database/tenant-context.service';
import { validateCpf, normalizeCpf } from './cpf.util';
import { CreateClientInput, UpdateClientInput } from './dto/client.input';

interface UserError {
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
      const where: any = { deletedAt: null };

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
      const conditions: any[] = [];
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
    if (!input.phone && !input.email) {
      return errPayload(
        'CONTACT_REQUIRED',
        'Informe pelo menos um telefone ou e-mail.',
      );
    }
    if (input.cpf && !validateCpf(input.cpf)) {
      return errPayload('CPF_INVALID', 'CPF inválido. Verifique os números.', 'cpf');
    }

    return this.tenant.runWithTenant(orgId, async (tx) => {
      const client = await tx.client.create({
        data: {
          organizationId: orgId,
          fullName: input.fullName,
          phone: input.phone ?? null,
          email: input.email?.toLowerCase() ?? null,
          cpf: input.cpf ? normalizeCpf(input.cpf) : null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          address: input.address ?? null,
          notes: input.notes ?? null,
        },
      });
      return { client, errors: [] as UserError[] };
    });
  }

  async update(orgId: string, input: UpdateClientInput) {
    if (input.cpf && !validateCpf(input.cpf)) {
      return errPayload('CPF_INVALID', 'CPF inválido.', 'cpf');
    }

    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.client.findFirst({
        where: { id: input.id, deletedAt: null },
      });
      if (!existing) return errPayload('NOT_FOUND', 'Cliente não encontrado.');

      const phone =
        input.phone !== undefined ? input.phone : existing.phone;
      const email =
        input.email !== undefined
          ? input.email?.toLowerCase() ?? null
          : existing.email;

      if (!phone && !email) {
        return errPayload(
          'CONTACT_REQUIRED',
          'Informe pelo menos um telefone ou e-mail.',
        );
      }

      const client = await tx.client.update({
        where: { id: input.id },
        data: {
          fullName: input.fullName ?? existing.fullName,
          phone,
          email,
          cpf:
            input.cpf !== undefined
              ? input.cpf
                ? normalizeCpf(input.cpf)
                : null
              : existing.cpf,
          birthDate:
            input.birthDate !== undefined
              ? input.birthDate
                ? new Date(input.birthDate)
                : null
              : existing.birthDate,
          address:
            input.address !== undefined ? input.address : existing.address,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          version: { increment: 1 },
        },
      });
      return { client, errors: [] as UserError[] };
    });
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
