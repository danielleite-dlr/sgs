import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ContractAlertsService } from './contract-alerts.service';
import { CONTRACT_ALERTS_QUEUE } from './contract-alerts.scheduler';

@Processor(CONTRACT_ALERTS_QUEUE)
export class ContractAlertsProcessor extends WorkerHost {
  constructor(private readonly alerts: ContractAlertsService) {
    super();
  }

  async process(): Promise<{ orgs: number; ran: number }> {
    return this.alerts.tick(new Date());
  }
}
