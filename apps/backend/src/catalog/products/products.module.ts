import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';

/**
 * ProductsModule — retail/consumable products with stock tracking (CAT-03).
 * Wave 2 plan adds: ProductService, ProductResolver, ProductDto, StockMovementDto.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class ProductsModule {}
