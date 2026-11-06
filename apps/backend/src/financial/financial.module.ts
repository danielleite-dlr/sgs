import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { ClientCreditService } from './client-credit.service';
import { FinancialResolver } from './financial.resolver';
import { FinancialService } from './financial.service';
import { FixedExpenseResolver } from './fixed-expense.resolver';
import { FixedExpenseService } from './fixed-expense.service';
import { ForecastResolver } from './forecast.resolver';
import { ForecastService } from './forecast.service';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [
    ClientCreditService,
    FinancialService,
    FinancialResolver,
    FixedExpenseService,
    FixedExpenseResolver,
    ForecastService,
    ForecastResolver,
  ],
  exports: [ClientCreditService, FinancialService],
})
export class FinancialModule {}
