import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';
import { PackagesService } from './packages.service';
import { PackagesResolver } from './packages.resolver';

/**
 * PackagesModule — fixed-composition service bundles with own price (CAT-02).
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [PackagesService, PackagesResolver],
  exports: [PackagesService],
})
export class PackagesModule {}
