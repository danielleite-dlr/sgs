import request from 'supertest';
import {
  createPhase4World,
  destroyPhase4World,
  type Phase4World,
} from './helpers/phase4-fixtures';

describe('Fase 4 - rate limit das rotas públicas do contrato', () => {
  let w: Phase4World;

  beforeAll(async () => {
    w = await createPhase4World('p4rl');
  });
  afterAll(async () => {
    await destroyPhase4World(w);
  });

  const token = 'x'.repeat(43);

  it('6º POST de aceite do mesmo IP no minuto recebe 429', async () => {
    const ip = '192.0.2.10';
    const post = () =>
      request(w.app.getHttpServer())
        .post(`/public/contracts/${w.orgId}/${token}/accept`)
        .set('X-Forwarded-For', ip)
        .send({ fullName: 'Maria da Silva', cpf: '000', accepted: true, textSha256: 'a' });
    for (let i = 0; i < 5; i++) {
      expect((await post()).status).toBe(422);
    }
    expect((await post()).status).toBe(429);
  });

  it('21º GET do mesmo IP no minuto recebe 429; outro IP não é afetado', async () => {
    const get = (ip: string) =>
      request(w.app.getHttpServer())
        .get(`/public/contracts/${w.orgId}/${token}`)
        .set('X-Forwarded-For', ip);
    for (let i = 0; i < 20; i++) {
      expect((await get('192.0.2.20')).status).toBe(404);
    }
    expect((await get('192.0.2.20')).status).toBe(429);
    expect((await get('192.0.2.21')).status).toBe(404);
  });
});
