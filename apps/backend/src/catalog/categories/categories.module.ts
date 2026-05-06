import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';

/**
 * CategoriesModule — hierarchical service categories (CAT-01).
 * Wave 2 plan adds: CategoryService, CategoryResolver, CategoryDto.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class CategoriesModule {}
