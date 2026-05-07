import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientsService } from './clients.service';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { CurrentTenant } from '../authz/decorators/current-tenant.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import type { TenantContext } from '../authz/decorators/current-tenant.decorator';

/**
 * ClientsResolver — GraphQL resolver for client profile CRUD.
 * Read ops: CLIENT_READ (ADMIN, MANAGER, ATTENDANT, PROFESSIONAL).
 * Write ops: CLIENT_WRITE (ADMIN, MANAGER, ATTENDANT — not PROFESSIONAL per D-02).
 */
@Resolver()
export class ClientsResolver {
  constructor(private readonly clients: ClientsService) {}

  @RequirePermission(PERMISSIONS.CLIENT_READ)
  @Query('clients')
  async listClients(
    @Args('search') search: string | undefined,
    @Args('limit') limit: number | undefined,
    @Args('offset') offset: number | undefined,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.clients.list(tenantCtx.organizationId, { search, limit, offset });
  }

  @RequirePermission(PERMISSIONS.CLIENT_READ)
  @Query('client')
  async getClient(
    @Args('id') id: string,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.clients.byId(tenantCtx.organizationId, id);
  }

  @RequirePermission(PERMISSIONS.CLIENT_READ)
  @Query('clientsByField')
  async clientsByField(
    @Args('cpf') cpf: string | undefined,
    @Args('phone') phone: string | undefined,
    @Args('email') email: string | undefined,
    @Args('excludeId') excludeId: string | undefined,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.clients.byField(tenantCtx.organizationId, {
      cpf,
      phone,
      email,
      excludeId,
    });
  }

  @RequirePermission(PERMISSIONS.CLIENT_READ)
  @Query('clientHistory')
  async clientHistory(
    @Args('clientId') clientId: string,
    @Args('filters') filters: any,
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.clients.history(tenantCtx.organizationId, clientId, filters);
  }

  @RequirePermission(PERMISSIONS.CLIENT_WRITE)
  @Mutation('createClient')
  async createClient(
    @Args('input')
    input: {
      fullName: string;
      phone?: string;
      email?: string;
      cpf?: string;
      birthDate?: string;
      address?: string;
      notes?: string;
    },
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.clients.create(tenantCtx.organizationId, input as any);
  }

  @RequirePermission(PERMISSIONS.CLIENT_WRITE)
  @Mutation('updateClient')
  async updateClient(
    @Args('input')
    input: {
      id: string;
      fullName?: string;
      phone?: string;
      email?: string;
      cpf?: string;
      birthDate?: string;
      address?: string;
      notes?: string;
    },
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.clients.update(tenantCtx.organizationId, input as any);
  }

  @RequirePermission(PERMISSIONS.CLIENT_WRITE)
  @Mutation('softDeleteClient')
  async softDeleteClient(
    @Args('input') input: { id: string },
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.clients.softDelete(tenantCtx.organizationId, input.id);
  }

  @RequirePermission(PERMISSIONS.CLIENT_WRITE)
  @Mutation('restoreClient')
  async restoreClient(
    @Args('input') input: { id: string },
    @CurrentTenant() tenantCtx: TenantContext,
  ) {
    return this.clients.restore(tenantCtx.organizationId, input.id);
  }
}
