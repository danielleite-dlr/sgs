import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ServicesService } from './services.service';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import { CreateServiceInput, SoftDeleteServiceInput, UpdateServiceInput } from './dto/service.input';

/**
 * ServicesResolver — schema-first GraphQL resolver for service CRUD (CAT-01).
 *
 * All queries require SERVICE_READ permission.
 * All mutations require SERVICE_WRITE permission.
 * TenantContext is resolved from JWT by TenantContextInterceptor (Phase 1).
 */
@Resolver()
export class ServicesResolver {
  constructor(private readonly svc: ServicesService) {}

  @Query('services')
  @RequirePermission(PERMISSIONS.SERVICE_READ)
  list(
    @CurrentTenant() t: TenantContext,
    @Args('categoryId') categoryId?: string,
  ) {
    return this.svc.list(t.organizationId, categoryId);
  }

  @Query('service')
  @RequirePermission(PERMISSIONS.SERVICE_READ)
  one(@CurrentTenant() t: TenantContext, @Args('id') id: string) {
    return this.svc.getById(t.organizationId, id);
  }

  @Mutation('createService')
  @RequirePermission(PERMISSIONS.SERVICE_WRITE)
  create(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: CreateServiceInput,
  ) {
    return this.svc.create(t.organizationId, input);
  }

  @Mutation('updateService')
  @RequirePermission(PERMISSIONS.SERVICE_WRITE)
  update(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: UpdateServiceInput,
  ) {
    return this.svc.update(t.organizationId, input);
  }

  @Mutation('softDeleteService')
  @RequirePermission(PERMISSIONS.SERVICE_WRITE)
  remove(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: SoftDeleteServiceInput,
  ) {
    return this.svc.softDelete(t.organizationId, input.id);
  }
}
