import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { ContractSettingsService } from './contract-settings.service';
import { ContractsResolver } from './contracts.resolver';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [ContractSettingsService, ContractsResolver],
  exports: [ContractSettingsService],
})
export class ContractsModule {}
