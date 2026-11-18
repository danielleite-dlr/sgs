import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfigService } from '../config/app-config.service';

export const COMMERCIAL_REMINDERS_QUEUE = 'commercial-reminders';

/** Registra (idempotente) o scheduler por minuto que dispara o tick dos lembretes. */
@Injectable()
export class CommercialRemindersScheduler implements OnModuleInit {
  private readonly logger = new Logger(CommercialRemindersScheduler.name);

  constructor(
    @InjectQueue(COMMERCIAL_REMINDERS_QUEUE) private readonly queue: Queue,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.commercialRemindersSchedulerEnabled) return;
    await this.queue.upsertJobScheduler(
      'commercial-reminders-tick',
      { pattern: '* * * * *' },
      { name: 'tick', opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    this.logger.log('Scheduler commercial-reminders-tick registrado (* * * * *)');
  }
}
