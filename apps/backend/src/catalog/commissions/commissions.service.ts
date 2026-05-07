import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../database/tenant-context.service';
import {
  CreateCommissionRuleInput,
  UpdateCommissionRuleInput,
} from './dto/commission.input';

export interface UserError {
  code: string;
  message: string;
  field?: string | null;
}

const errPayload = (code: string, message: string, field?: string) => ({
  rule: null,
  errors: [{ code, message, field: field ?? null }] as UserError[],
});

/**
 * CommissionsService — CRUD for commission_rule with 5-scope validation.
 *
 * Scope shapes (DB CHECK constraint also enforces these):
 *   member_service → memberId + serviceId (no category/product)
 *   service        → serviceId only
 *   category       → categoryId only
 *   product        → productId only
 *   default        → no foreign keys
 *
 * Conflict detection: unique partial index per scope per org (Plan 01 DB).
 * P2002 is caught and returned as COMMISSION_SCOPE_CONFLICT user error.
 * Soft-delete unblocks the unique index so the same scope can be re-created.
 *
 * Calculation (FIN-02) is Phase 3 — this plan delivers CRUD only.
 */
@Injectable()
export class CommissionsService {
  constructor(private readonly tenant: TenantContextService) {}

  async list(orgId: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.commissionRule.findMany({
        where: { organizationId: orgId, deletedAt: null },
        include: {
          member: { include: { user: { select: { email: true } } } },
          service: true,
          category: true,
          product: true,
        },
        orderBy: [{ scopeType: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  }

  async byId(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, (tx) =>
      tx.commissionRule.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        include: {
          member: { include: { user: { select: { email: true } } } },
          service: true,
          category: true,
          product: true,
        },
      }),
    );
  }

  async create(orgId: string, input: CreateCommissionRuleInput) {
    // Defense-in-depth: validate scope shape before hitting DB
    const shapeError = this.validateScopeShape(input);
    if (shapeError) return errPayload(shapeError.code, shapeError.message, shapeError.field);

    // Range check for percentage values
    if (input.kind === 'percentage' && Number(input.value) > 100) {
      return errPayload(
        'VALUE_OUT_OF_RANGE',
        'Percentual deve ser entre 0 e 100.',
        'value',
      );
    }

    return this.tenant.runWithTenant(orgId, async (tx) => {
      try {
        const rule = await tx.commissionRule.create({
          data: {
            organizationId: orgId,
            scopeType: input.scopeType,
            kind: input.kind,
            value: input.value,
            memberId: input.memberId ?? null,
            serviceId: input.serviceId ?? null,
            categoryId: input.categoryId ?? null,
            productId: input.productId ?? null,
          },
          include: {
            member: { include: { user: { select: { email: true } } } },
            service: true,
            category: true,
            product: true,
          },
        });
        return { rule, errors: [] as UserError[] };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          return errPayload(
            'COMMISSION_SCOPE_CONFLICT',
            'Já existe uma regra para este escopo. Edite a regra existente ou exclua-a antes de criar uma nova.',
          );
        }
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2003'
        ) {
          return errPayload(
            'REFERENCE_NOT_FOUND',
            'Referência inválida (profissional, serviço, categoria ou produto não encontrado).',
          );
        }
        throw e;
      }
    });
  }

  async update(orgId: string, input: UpdateCommissionRuleInput) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.commissionRule.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
      });
      if (!existing) return errPayload('NOT_FOUND', 'Regra não encontrada.');

      if (
        input.kind === 'percentage' &&
        input.value !== undefined &&
        Number(input.value) > 100
      ) {
        return errPayload(
          'VALUE_OUT_OF_RANGE',
          'Percentual deve ser entre 0 e 100.',
          'value',
        );
      }
      // Also check if updating kind to percentage with existing value
      const newKind = input.kind ?? existing.kind;
      const newValue = input.value ?? String(existing.value);
      if (newKind === 'percentage' && Number(newValue) > 100) {
        return errPayload(
          'VALUE_OUT_OF_RANGE',
          'Percentual deve ser entre 0 e 100.',
          'value',
        );
      }

      const rule = await tx.commissionRule.update({
        where: { id: input.id },
        data: {
          kind: input.kind ?? existing.kind,
          value: input.value ?? existing.value,
        },
        include: {
          member: { include: { user: { select: { email: true } } } },
          service: true,
          category: true,
          product: true,
        },
      });
      return { rule, errors: [] as UserError[] };
    });
  }

  async softDelete(orgId: string, id: string) {
    return this.tenant.runWithTenant(orgId, async (tx) => {
      const existing = await tx.commissionRule.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
      });
      if (!existing) return errPayload('NOT_FOUND', 'Regra não encontrada.');

      const rule = await tx.commissionRule.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: {
          member: { include: { user: { select: { email: true } } } },
          service: true,
          category: true,
          product: true,
        },
      });
      return { rule, errors: [] as UserError[] };
    });
  }

  /**
   * Validates that the FK fields provided match the expected scope shape.
   * Returns an error descriptor if invalid, or null if valid.
   */
  private validateScopeShape(i: CreateCommissionRuleInput): {
    code: string;
    message: string;
    field: string;
  } | null {
    const has = {
      member: !!i.memberId,
      service: !!i.serviceId,
      category: !!i.categoryId,
      product: !!i.productId,
    };

    switch (i.scopeType) {
      case 'member_service':
        if (!has.member || !has.service || has.category || has.product) {
          return {
            code: 'SCOPE_INVALID',
            message:
              'Escopo "Profissional+Serviço" requer memberId e serviceId, sem categoria ou produto.',
            field: 'scopeType',
          };
        }
        return null;

      case 'service':
        if (!has.service || has.member || has.category || has.product) {
          return {
            code: 'SCOPE_INVALID',
            message:
              'Escopo "Serviço" requer apenas serviceId.',
            field: 'scopeType',
          };
        }
        return null;

      case 'category':
        if (!has.category || has.member || has.service || has.product) {
          return {
            code: 'SCOPE_INVALID',
            message:
              'Escopo "Categoria" requer apenas categoryId.',
            field: 'scopeType',
          };
        }
        return null;

      case 'product':
        if (!has.product || has.member || has.service || has.category) {
          return {
            code: 'SCOPE_INVALID',
            message:
              'Escopo "Produto" requer apenas productId.',
            field: 'scopeType',
          };
        }
        return null;

      case 'default':
        if (has.member || has.service || has.category || has.product) {
          return {
            code: 'SCOPE_INVALID',
            message:
              'Escopo "Padrão" não aceita referências (memberId, serviceId, categoryId, productId devem estar ausentes).',
            field: 'scopeType',
          };
        }
        return null;

      default:
        return {
          code: 'SCOPE_INVALID',
          message: 'Tipo de escopo inválido.',
          field: 'scopeType',
        };
    }
  }
}
