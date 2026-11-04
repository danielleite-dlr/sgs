import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfigService } from '../../config/app-config.service';

export const CONTRACT_ALERTS_QUEUE = 'contract-alerts';

/** Registra (idempotente) o scheduler horário que dispara o tick dos alertas. */
@Injectable()
export class ContractAlertsScheduler implements OnModuleInit {
  private readonly logger = new Logger(ContractAlertsScheduler.name);

  constructor(
    @InjectQueue(CONTRACT_ALERTS_QUEUE) private readonly queue: Queue,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.contractAlertsSchedulerEnabled) return;
    await this.queue.upsertJobScheduler(
      'contract-alerts-tick',
      { pattern: '0 * * * *' },
      { name: 'tick', opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    this.logger.log('Scheduler contract-alerts-tick registrado (0 * * * *)');
  }
}
