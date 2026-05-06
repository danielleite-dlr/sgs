import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';

/**
 * ServicesModule — salon services with pricing variants (CAT-01).
 * Wave 2 plan adds: ServiceService, ServiceResolver, ServiceDto, ServicePricingVariantDto.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class ServicesModule {}
