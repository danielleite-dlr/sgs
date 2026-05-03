import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantContextService } from './tenant-context.service';

/**
 * @Global() ensures PrismaService and TenantContextService are available
 * throughout the application without importing DatabaseModule into every feature module.
 */
@Global()
@Module({
  providers: [PrismaService, TenantContextService],
  exports: [PrismaService, TenantContextService],
})
export class DatabaseModule {}
