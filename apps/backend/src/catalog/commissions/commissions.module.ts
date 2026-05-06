import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthzModule } from '../../authz/authz.module';

/**
 * CommissionsModule — commission rule configuration (CAT-04).
 * Wave 2 plan adds: CommissionService, CommissionResolver, CommissionRuleDto.
 * Actual commission calculation (snapshot at comanda close) is Phase 3.
 */
@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [],
  exports: [],
})
export class CommissionsModule {}
