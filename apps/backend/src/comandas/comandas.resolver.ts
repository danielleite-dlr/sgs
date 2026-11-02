import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentTenant,
  TenantContext,
} from '../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../authz/permissions.catalog';
import { ComandasService } from './comandas.service';

@Resolver()
export class ComandasResolver {
  constructor(private readonly comandas: ComandasService) {}

  @Query('comanda')
  @RequirePermission(PERMISSIONS.COMANDA_READ)
  get(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.comandas.get(tenant.organizationId, tenant, id);
  }

  @Query('comandas')
  @RequirePermission(PERMISSIONS.COMANDA_READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Args('from') from: string,
    @Args('to') to: string,
    @Args('status') status?: string,
    @Args('clientId') clientId?: string,
  ) {
    return this.comandas.list(tenant.organizationId, tenant, {
      from,
      to,
      status,
      clientId,
    });
  }

  @Mutation('openWalkInComanda')
  @RequirePermission(PERMISSIONS.COMANDA_WRITE)
  openWalkIn(
    @CurrentTenant() tenant: TenantContext,
    @Args('input')
    input: {
      clientId?: string | null;
      newClient?: { fullName: string; phone?: string | null } | null;
    },
  ) {
    return this.comandas.openWalkIn(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('addComandaItem')
  @RequirePermission(PERMISSIONS.COMANDA_WRITE)
  addItem(
    @CurrentTenant() tenant: TenantContext,
    @Args('input')
    input: {
      comandaId: string;
      kind: string;
      serviceId?: string | null;
      serviceVariantId?: string | null;
      productId?: string | null;
      professionalId: string;
      quantity: number;
    },
  ) {
    return this.comandas.addItem(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('removeComandaItem')
  @RequirePermission(PERMISSIONS.COMANDA_WRITE)
  removeItem(
    @CurrentTenant() tenant: TenantContext,
    @Args('comandaId') comandaId: string,
    @Args('itemId') itemId: string,
  ) {
    return this.comandas.removeItem(tenant.organizationId, comandaId, itemId);
  }

  @Mutation('addComandaPackage')
  @RequirePermission(PERMISSIONS.COMANDA_WRITE)
  addPackage(
    @CurrentTenant() tenant: TenantContext,
    @Args('input')
    input: {
      comandaId: string;
      packageId: string;
      assignments: {
        serviceId: string;
        professionalId: string;
        serviceVariantId?: string | null;
      }[];
    },
  ) {
    return this.comandas.addPackage(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('addComandaPayment')
  @RequirePermission(PERMISSIONS.COMANDA_WRITE)
  addPayment(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: { comandaId: string; method: string; amount: string },
  ) {
    return this.comandas.addPayment(tenant.organizationId, tenant.memberId, input);
  }

  @Mutation('removeComandaPayment')
  @RequirePermission(PERMISSIONS.COMANDA_WRITE)
  removePayment(
    @CurrentTenant() tenant: TenantContext,
    @Args('comandaId') comandaId: string,
    @Args('paymentId') paymentId: string,
  ) {
    return this.comandas.removePayment(tenant.organizationId, comandaId, paymentId);
  }

  @Mutation('closeComanda')
  @RequirePermission(PERMISSIONS.COMANDA_CLOSE)
  close(@CurrentTenant() tenant: TenantContext, @Args('id') id: string) {
    return this.comandas.close(tenant.organizationId, tenant, id);
  }

  @Mutation('reopenComanda')
  @RequirePermission(PERMISSIONS.COMANDA_REOPEN)
  reopen(
    @CurrentTenant() tenant: TenantContext,
    @Args('input') input: { id: string; reason: string },
  ) {
    return this.comandas.reopen(tenant.organizationId, tenant, input);
  }
}
