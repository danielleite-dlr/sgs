import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';
import { CategoriesService } from './categories.service';
import { CategoriesResolver } from './categories.resolver';

/**
 * CategoriesModule — hierarchical service categories (CAT-01).
 * Exports CategoriesService so ServicesModule can validate categoryId references.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [CategoriesService, CategoriesResolver],
  exports: [CategoriesService],
})
export class CategoriesModule {}
