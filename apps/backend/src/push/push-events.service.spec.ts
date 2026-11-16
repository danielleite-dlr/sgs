import { PushEventsService } from './push-events.service';
import type { PushJob } from './push.types';

const JOB: PushJob = {
  kind: 'appointment.created',
  orgId: 'o1',
  actorMemberId: 'm1',
  appointmentIds: ['a1'],
};

describe('PushEventsService.enqueue', () => {
  it('enfileira sem esperar o Redis', () => {
    const add = jest.fn().mockReturnValue(new Promise(() => undefined));
    const svc = new PushEventsService({ add } as never);
    expect(() => svc.enqueue(JOB)).not.toThrow();
    expect(add).toHaveBeenCalledWith('appointment.created', JOB, {
      removeOnComplete: true,
      removeOnFail: 100,
    });
  });

  it('não lança quando queue.add rejeita', async () => {
    const add = jest.fn().mockRejectedValue(new Error('redis fora'));
    const svc = new PushEventsService({ add } as never);
    expect(() => svc.enqueue(JOB)).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });

  it('não lança quando queue.add lança de forma síncrona', () => {
    const add = jest.fn(() => {
      throw new Error('boom');
    });
    const svc = new PushEventsService({ add } as never);
    expect(() => svc.enqueue(JOB)).not.toThrow();
  });

  it('ignora lista de atendimentos vazia', () => {
    const add = jest.fn();
    const svc = new PushEventsService({ add } as never);
    svc.enqueue({ ...JOB, appointmentIds: [] });
    expect(add).not.toHaveBeenCalled();
  });
});
