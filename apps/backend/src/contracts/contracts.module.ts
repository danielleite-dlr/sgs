import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { ContractSettingsService } from './contract-settings.service';
import { ContractsResolver } from './contracts.resolver';
import { ContractsService } from './contracts.service';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [ContractsService, ContractSettingsService, ContractsResolver],
  exports: [ContractsService, ContractSettingsService],
})
export class ContractsModule {}
