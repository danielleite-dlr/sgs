import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';
import { ServicesService } from './services.service';
import { ServicesResolver } from './services.resolver';

/**
 * ServicesModule — salon services with pricing variants (CAT-01).
 * Exports ServicesService so PackagesModule can validate serviceId references.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [ServicesService, ServicesResolver],
  exports: [ServicesService],
})
export class ServicesModule {}
