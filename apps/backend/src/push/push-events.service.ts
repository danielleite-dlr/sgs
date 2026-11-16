import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PUSH_QUEUE, type PushJob } from './push.types';

@Injectable()
export class PushEventsService {
  private readonly logger = new Logger(PushEventsService.name);

  constructor(@InjectQueue(PUSH_QUEUE) private readonly queue: Queue) {}

  /**
   * Fire-and-forget: nunca lança, nunca espera o Redis.
   * Chamar só DEPOIS do commit e só se a operação deu certo.
   */
  enqueue(job: PushJob): void {
    if ('appointmentIds' in job && job.appointmentIds.length === 0) return;
    try {
      void this.queue
        .add(job.kind, job, { removeOnComplete: true, removeOnFail: 100 })
        .catch((e: unknown) =>
          this.logger.warn(`Push não enfileirado (${job.kind}): ${(e as Error).message}`),
        );
    } catch (e) {
      this.logger.warn(`Push não enfileirado (${job.kind}): ${(e as Error).message}`);
    }
  }
}
