import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { ClientCreditService } from './client-credit.service';
import { FinancialResolver } from './financial.resolver';
import { FinancialService } from './financial.service';
import { FixedExpenseResolver } from './fixed-expense.resolver';
import { FixedExpenseService } from './fixed-expense.service';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [
    ClientCreditService,
    FinancialService,
    FinancialResolver,
    FixedExpenseService,
    FixedExpenseResolver,
  ],
  exports: [ClientCreditService, FinancialService],
})
export class FinancialModule {}
