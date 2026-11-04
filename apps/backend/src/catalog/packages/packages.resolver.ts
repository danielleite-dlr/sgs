import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { canSeeCatalogCosts } from '../catalog-costs';
import { PackagesService } from './packages.service';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import {
  CreatePackageInput,
  SoftDeletePackageInput,
  UpdatePackageInput,
} from './dto/package.input';

/**
 * PackagesResolver — schema-first GraphQL resolver for package CRUD (CAT-02).
 *
 * All queries require PACKAGE_READ permission.
 * All mutations require PACKAGE_WRITE permission.
 * TenantContext is resolved from JWT by TenantContextInterceptor (Phase 1).
 *
 * Note: `individualSum` is computed in the service layer (not a @ResolveField)
 * because schema-first resolvers don't use code-first @ResolveField decorators.
 * The service populates it on every loadFull() call.
 */
@Resolver('Package')
export class PackagesResolver {
  constructor(private readonly svc: PackagesService) {}

  @Query('packages')
  @RequirePermission(PERMISSIONS.PACKAGE_READ)
  list(@CurrentTenant() t: TenantContext) {
    return this.svc.list(t.organizationId);
  }

  @Query('package')
  @RequirePermission(PERMISSIONS.PACKAGE_READ)
  one(@CurrentTenant() t: TenantContext, @Args('id') id: string) {
    return this.svc.getById(t.organizationId, id);
  }

  @Mutation('createPackage')
  @RequirePermission(PERMISSIONS.PACKAGE_WRITE)
  create(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: CreatePackageInput,
  ) {
    return this.svc.create(t.organizationId, input);
  }

  @Mutation('updatePackage')
  @RequirePermission(PERMISSIONS.PACKAGE_WRITE)
  update(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: UpdatePackageInput,
  ) {
    return this.svc.update(t.organizationId, input);
  }

  @Mutation('softDeletePackage')
  @RequirePermission(PERMISSIONS.PACKAGE_WRITE)
  remove(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: SoftDeletePackageInput,
  ) {
    return this.svc.softDelete(t.organizationId, input.id);
  }

  // Custos e lucro só para ADMIN/MANAGER (o service sempre calcula).
  @ResolveField('costItems')
  costItems(@Parent() p: { costItems?: unknown[] }, @CurrentTenant() t: TenantContext | null) {
    return canSeeCatalogCosts(t?.roleName) ? (p.costItems ?? []) : null;
  }

  @ResolveField('totalCost')
  totalCost(@Parent() p: { totalCost?: string }, @CurrentTenant() t: TenantContext | null) {
    return canSeeCatalogCosts(t?.roleName) ? (p.totalCost ?? null) : null;
  }

  @ResolveField('profit')
  profit(@Parent() p: { profit?: string }, @CurrentTenant() t: TenantContext | null) {
    return canSeeCatalogCosts(t?.roleName) ? (p.profit ?? null) : null;
  }

  @ResolveField('profitPercent')
  profitPercent(@Parent() p: { profitPercent?: string }, @CurrentTenant() t: TenantContext | null) {
    return canSeeCatalogCosts(t?.roleName) ? (p.profitPercent ?? null) : null;
  }
}
