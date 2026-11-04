import { BullModule } from '@nestjs/bullmq';
import { Module, type Provider } from '@nestjs/common';
import { AuthzModule } from '../../authz/authz.module';
import { DatabaseModule } from '../../database/database.module';
import { ContractsModule } from '../contracts.module';
import { ContractAlertsProcessor } from './contract-alerts.processor';
import { ContractAlertsResolver } from './contract-alerts.resolver';
import { CONTRACT_ALERTS_QUEUE, ContractAlertsScheduler } from './contract-alerts.scheduler';
import { ContractAlertsService } from './contract-alerts.service';

/**
 * Scheduler e processor só entram quando CONTRACT_ALERTS_SCHEDULER != 'false'
 * (lido de process.env na carga do módulo; suítes de integração definem 'false').
 * O EmailModule é global, então não precisa ser importado.
 */
const workerProviders: Provider[] =
  process.env.CONTRACT_ALERTS_SCHEDULER !== 'false'
    ? [ContractAlertsScheduler, ContractAlertsProcessor]
    : [];

@Module({
  imports: [
    BullModule.registerQueue({ name: CONTRACT_ALERTS_QUEUE }),
    DatabaseModule,
    AuthzModule,
    ContractsModule,
  ],
  providers: [ContractAlertsService, ContractAlertsResolver, ...workerProviders],
  exports: [ContractAlertsService],
})
export class ContractAlertsModule {}
