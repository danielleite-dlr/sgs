import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { DatabaseModule } from '../database/database.module';
import { ContractLetterheadResolver } from './contract-letterhead.resolver';
import { ContractLetterheadService } from './contract-letterhead.service';
import { ContractSettingsService } from './contract-settings.service';
import { ContractsResolver } from './contracts.resolver';
import { ContractsService } from './contracts.service';

@Module({
  imports: [DatabaseModule, AuthzModule],
  providers: [
    ContractsService,
    ContractSettingsService,
    ContractsResolver,
    ContractLetterheadService,
    ContractLetterheadResolver,
  ],
  exports: [ContractsService, ContractSettingsService, ContractLetterheadService],
})
export class ContractsModule {}
