import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';

/**
 * PackagesModule — service bundles at fixed price (CAT-02).
 * Wave 2 plan adds: PackageService, PackageResolver, PackageDto.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class PackagesModule {}
