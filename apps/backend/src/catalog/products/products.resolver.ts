import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ProductsService } from './products.service';
import {
  CurrentTenant,
  TenantContext,
} from '../../authz/decorators/current-tenant.decorator';
import { RequirePermission } from '../../authz/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../authz/permissions.catalog';
import { AdjustStockInput, CreateProductInput, UpdateProductInput } from './dto/product.input';

@Resolver('Product')
export class ProductsResolver {
  constructor(private readonly svc: ProductsService) {}

  @Query('products')
  @RequirePermission(PERMISSIONS.PRODUCT_READ)
  list(
    @CurrentTenant() t: TenantContext,
    @Args('lowStockOnly') lowStockOnly?: boolean,
  ) {
    return this.svc.list(t.organizationId, lowStockOnly ?? false);
  }

  @Query('product')
  @RequirePermission(PERMISSIONS.PRODUCT_READ)
  one(@CurrentTenant() t: TenantContext, @Args('id') id: string) {
    return this.svc.byId(t.organizationId, id);
  }

  @Query('lowStockCount')
  @RequirePermission(PERMISSIONS.PRODUCT_READ)
  count(@CurrentTenant() t: TenantContext) {
    return this.svc.lowStockCount(t.organizationId);
  }

  @Query('productStockMovements')
  @RequirePermission(PERMISSIONS.PRODUCT_READ)
  movements(
    @CurrentTenant() t: TenantContext,
    @Args('productId') productId: string,
  ) {
    return this.svc.stockMovements(t.organizationId, productId);
  }

  @Mutation('createProduct')
  @RequirePermission(PERMISSIONS.PRODUCT_WRITE)
  create(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: CreateProductInput,
  ) {
    return this.svc.create(t.organizationId, t.memberId, input);
  }

  @Mutation('updateProduct')
  @RequirePermission(PERMISSIONS.PRODUCT_WRITE)
  update(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: UpdateProductInput,
  ) {
    return this.svc.update(t.organizationId, input);
  }

  @Mutation('softDeleteProduct')
  @RequirePermission(PERMISSIONS.PRODUCT_WRITE)
  remove(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: { id: string },
  ) {
    return this.svc.softDelete(t.organizationId, input.id);
  }

  @Mutation('adjustStock')
  @RequirePermission(PERMISSIONS.PRODUCT_ADJUST_STOCK)
  adjustStock(
    @CurrentTenant() t: TenantContext,
    @Args('input') input: AdjustStockInput,
  ) {
    return this.svc.adjustStock(t.organizationId, t.memberId, input);
  }

  @ResolveField('isLowStock')
  isLowStock(
    @Parent() p: { stockQuantity: number; minStockLevel: number },
  ): boolean {
    return ProductsService.isLowStock(p);
  }
}
