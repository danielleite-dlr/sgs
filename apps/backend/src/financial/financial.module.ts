import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { ClientCreditService } from './client-credit.service';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [ClientCreditService],
  exports: [ClientCreditService],
})
export class FinancialModule {}
