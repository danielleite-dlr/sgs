import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsService } from './products.service';
import { ProductsResolver } from './products.resolver';

@Module({
  imports: [DatabaseModule, AuthzModule, forwardRef(() => NotificationsModule)],
  providers: [ProductsService, ProductsResolver],
  exports: [ProductsService],
})
export class ProductsModule {}
