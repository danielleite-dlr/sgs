import { Injectable } from '@nestjs/common';
import { fromCents, parseMoneyInput, toCents } from '../common/money';
import { TenantContextService } from '../database/tenant-context.service';
import type { FinancialUserError } from './client-credit.service';

export interface FixedExpenseInputDto {
  name: string;
  amount: string;
  dueDay: number;
  active?: boolean | null;
}

interface FixedExpenseRow {
  id: string;
  name: string;
  amount: { toString(): string };
  dueDay: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FixedExpenseDto {
  id: string;
  name: string;
  amount: string;
  dueDay: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FixedExpensePayloadDto {
  fixedExpense: FixedExpenseDto | null;
  errors: FinancialUserError[];
}

function toDto(r: FixedExpenseRow): FixedExpenseDto {
  return {
    id: r.id,
    name: r.name,
    amount: fromCents(toCents(r.amount.toString())),
    dueDay: r.dueDay,
    active: r.active,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

const NOT_FOUND: FinancialUserError = {
  code: 'NOT_FOUND',
  message: 'Despesa fixa não encontrada.',
  field: null,
};

function invalid(code: string, message: string, field: string) {
  return { errors: [{ code, message, field }] as FinancialUserError[] };
}

function validate(
  input: FixedExpenseInputDto,
): { errors: FinancialUserError[] } | { name: string; cents: number } {
  const name = (input.name ?? '').trim();
  if (name.length < 2 || name.length > 120) {
    return invalid(
      'INVALID_NAME',
      'Informe o nome da despesa (2 a 120 caracteres).',
      'name',
    );
  }
  const cents = parseMoneyInput(input.amount);
  if (cents === null || cents <= 0) {
    return invalid('INVALID_AMOUNT', 'Informe um valor maior que zero.', 'amount');
  }
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) {
    return invalid(
      'INVALID_DUE_DAY',
      'O dia do vencimento deve ser entre 1 e 31.',
      'dueDay',
    );
  }
  return { name, cents };
}

@Injectable()
export class FixedExpenseService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(orgId: string): Promise<FixedExpenseDto[]> {
    const rows = await this.tenant.runWithTenant(orgId, (tx) =>
      tx.fixedExpense.findMany({ orderBy: [{ name: 'asc' }] }),
    );
    return rows.map(toDto);
  }

  async create(
    orgId: string,
    input: FixedExpenseInputDto,
  ): Promise<FixedExpensePayloadDto> {
    const v = validate(input);
    if ('errors' in v) return { fixedExpense: null, errors: v.errors };
    const row = await this.tenant.runWithTenant(orgId, (tx) =>
      tx.fixedExpense.create({
        data: {
          organizationId: orgId,
          name: v.name,
          amount: fromCents(v.cents),
          dueDay: input.dueDay,
          active: input.active ?? true,
        },
      }),
    );
    return { fixedExpense: toDto(row), errors: [] };
  }

  async update(
    orgId: string,
    id: string,
    input: FixedExpenseInputDto,
  ): Promise<FixedExpensePayloadDto> {
    const v = validate(input);
    if ('errors' in v) return { fixedExpense: null, errors: v.errors };
    const row = await this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.fixedExpense.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.fixedExpense.update({
        where: { id },
        data: {
          name: v.name,
          amount: fromCents(v.cents),
          dueDay: input.dueDay,
          active: input.active ?? true,
        },
      });
    });
    if (!row) return { fixedExpense: null, errors: [NOT_FOUND] };
    return { fixedExpense: toDto(row), errors: [] };
  }

  async remove(orgId: string, id: string): Promise<FixedExpensePayloadDto> {
    const row = await this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.fixedExpense.findFirst({ where: { id } });
      if (!existing) return null;
      await tx.fixedExpense.delete({ where: { id } });
      return existing;
    });
    if (!row) return { fixedExpense: null, errors: [NOT_FOUND] };
    return { fixedExpense: toDto(row), errors: [] };
  }
}
