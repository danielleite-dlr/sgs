import { Module } from '@nestjs/common';
import { AuthzModule } from '../../authz/authz.module';
import { DatabaseModule } from '../../database/database.module';
import { ContractPaymentsResolver } from './contract-payments.resolver';
import { ContractPaymentsService } from './contract-payments.service';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [ContractPaymentsService, ContractPaymentsResolver],
  exports: [ContractPaymentsService],
})
export class ContractPaymentsModule {}
