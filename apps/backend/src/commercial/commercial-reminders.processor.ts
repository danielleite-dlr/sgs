import { Processor, WorkerHost } from '@nestjs/bullmq';
import { CommercialRemindersService } from './commercial-reminders.service';
import { COMMERCIAL_REMINDERS_QUEUE } from './commercial-reminders.scheduler';

@Processor(COMMERCIAL_REMINDERS_QUEUE)
export class CommercialRemindersProcessor extends WorkerHost {
  constructor(private readonly reminders: CommercialRemindersService) {
    super();
  }

  async process(): Promise<{ orgs: number; notified: number }> {
    return this.reminders.tick(new Date());
  }
}
