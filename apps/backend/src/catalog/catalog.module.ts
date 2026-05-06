import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';
import { PackagesModule } from './packages/packages.module';
import { ProductsModule } from './products/products.module';
import { CommissionsModule } from './commissions/commissions.module';
import { NotificationsModule } from './notifications/notifications.module';

/**
 * CatalogModule — aggregates all catalog bounded contexts.
 * Sub-modules implement their own resolvers/services in Wave 2 plans.
 * Registered in AppModule so Wave 2 plans only touch their own module files.
 */
@Module({
  imports: [
    CategoriesModule,
    ServicesModule,
    PackagesModule,
    ProductsModule,
    CommissionsModule,
    NotificationsModule,
  ],
})
export class CatalogModule {}
