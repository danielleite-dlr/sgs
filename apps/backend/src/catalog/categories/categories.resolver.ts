import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CategoriesService } from './categories.service';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import {
  CreateCategoryInput,
  ReorderCategoryInput,
  SoftDeleteInput,
  UpdateCategoryInput,
} from './dto/category.input';

/**
 * CategoriesResolver — schema-first GraphQL resolver for category CRUD.
 *
 * All queries require CATEGORY_READ permission.
 * All mutations require CATEGORY_WRITE permission.
 * TenantContext is resolved from JWT by TenantContextInterceptor (Phase 1).
 */
@Resolver()
export class CategoriesResolver {
  constructor(private readonly svc: CategoriesService) {}

  @Query('categories')
  @RequirePermission(PERMISSIONS.CATEGORY_READ)
  list(@CurrentTenant() t: TenantContext) {
    return this.svc.list(t.organizationId);
  }

  @Query('category')
  @RequirePermission(PERMISSIONS.CATEGORY_READ)
  one(@CurrentTenant() t: TenantContext, @Args('id') id: string) {
    return this.svc.getById(t.organizationId, id);
  }

  @Mutation('createCategory')
  @RequirePermission(PERMISSIONS.CATEGORY_WRITE)
  create(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: CreateCategoryInput,
  ) {
    return this.svc.create(t.organizationId, input);
  }

  @Mutation('updateCategory')
  @RequirePermission(PERMISSIONS.CATEGORY_WRITE)
  update(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: UpdateCategoryInput,
  ) {
    return this.svc.update(t.organizationId, input);
  }

  @Mutation('reorderCategory')
  @RequirePermission(PERMISSIONS.CATEGORY_WRITE)
  reorder(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: ReorderCategoryInput,
  ) {
    return this.svc.reorder(t.organizationId, input);
  }

  @Mutation('softDeleteCategory')
  @RequirePermission(PERMISSIONS.CATEGORY_WRITE)
  remove(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: SoftDeleteInput,
  ) {
    return this.svc.softDelete(t.organizationId, input.id);
  }
}
