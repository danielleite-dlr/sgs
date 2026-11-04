// Antes de carregar o AppModule: liga o scheduler (o setup.ts define 'false' por padrão).
process.env.CONTRACT_ALERTS_SCHEDULER = 'true';

import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { EMAIL_ADAPTER } from '../../src/email/email.tokens';
import { TestEmailAdapter } from '../../src/email/test-email.adapter';

describe('Phase 4 - boot com scheduler de alertas ligado', () => {
  let app: INestApplication;
  let queue: Queue;

  beforeAll(async () => {
    const { AppModule } = await import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_ADAPTER)
      .useClass(TestEmailAdapter)
      .compile();
    app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.init();
    queue = app.get<Queue>(getQueueToken('contract-alerts'));
  });

  afterAll(async () => {
    try {
      await queue?.removeJobScheduler('contract-alerts-tick');
    } finally {
      await app?.close();
    }
  });

  it('registra o job scheduler horário contract-alerts-tick', async () => {
    const schedulers = await queue.getJobSchedulers();
    const s = schedulers.find((x) => x.key === 'contract-alerts-tick');
    expect(s).toBeDefined();
    expect(s?.pattern).toBe('0 * * * *');
  });

  it('é idempotente: subir de novo não duplica o scheduler', async () => {
    await queue.upsertJobScheduler(
      'contract-alerts-tick',
      { pattern: '0 * * * *' },
      { name: 'tick' },
    );
    const schedulers = await queue.getJobSchedulers();
    expect(schedulers.filter((x) => x.key === 'contract-alerts-tick')).toHaveLength(1);
  });
});
