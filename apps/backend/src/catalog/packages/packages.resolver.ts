import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
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
@Resolver()
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
}
