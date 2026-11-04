import { Module } from '@nestjs/common';
import { AuthzModule } from '../../authz/authz.module';
import { ContractsModule } from '../../contracts/contracts.module';
import { DatabaseModule } from '../../database/database.module';
import { BridalModule } from '../bridal.module';
import { AiScheduleContextBuilder } from './ai-schedule-context';
import { AiScheduleResolver } from './ai-schedule.resolver';
import { AiScheduleService } from './ai-schedule.service';
import { anthropicClientProvider } from './anthropic-client';

@Module({
  imports: [DatabaseModule, AuthzModule, BridalModule, ContractsModule],
  providers: [
    anthropicClientProvider,
    AiScheduleContextBuilder,
    AiScheduleService,
    AiScheduleResolver,
  ],
  exports: [AiScheduleService],
})
export class AiScheduleModule {}
