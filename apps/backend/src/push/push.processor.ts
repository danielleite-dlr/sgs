import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PushService } from './push.service';
import { PUSH_QUEUE, type PushJob } from './push.types';

@Processor(PUSH_QUEUE)
export class PushProcessor extends WorkerHost {
  constructor(private readonly push: PushService) {
    super();
  }

  process(job: Job<PushJob>) {
    return this.push.dispatch(job.data);
  }
}
