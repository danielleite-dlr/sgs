import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';
import { CommissionsService } from './commissions.service';
import { CommissionsResolver } from './commissions.resolver';

/**
 * CommissionsModule — commission rule configuration (CAT-04).
 *
 * Phase 2: CRUD for 5-scope commission rules (member_service, service,
 * category, product, default) with conflict detection and soft-delete.
 *
 * Phase 3 (FIN-02) will consume CommissionsService to snapshot rules
 * at comanda close time.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [CommissionsService, CommissionsResolver],
  exports: [CommissionsService],
})
export class CommissionsModule {}
