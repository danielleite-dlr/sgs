import request from 'supertest';
import {
  createPhase3World,
  destroyPhase3World,
  gqlAs,
  type Phase3World,
} from './helpers/phase3-fixtures';

const QUERY = '{ pushConfig { webPushPublicKey } }';

describe('Fase 8 - pushConfig', () => {
  let w: Phase3World;

  beforeAll(async () => {
    w = await createPhase3World('p8pushcfg');
  });

  afterAll(async () => {
    await destroyPhase3World(w);
  });

  it('usuária logada, sem VAPID no env, recebe webPushPublicKey null', async () => {
    const r = await gqlAs(w, w.tokens.attendant)(QUERY);
    expect(r.errors).toBeUndefined();
    expect(r.data.pushConfig).toEqual({ webPushPublicKey: null });
  });

  it('sem token volta erro de autenticação, não 500', async () => {
    const res = await request(w.app.getHttpServer())
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({ query: QUERY });
    expect(res.status).not.toBe(500);
    expect(res.body.data?.pushConfig ?? null).toBeNull();
    expect(res.body.errors?.length ?? 0).toBeGreaterThan(0);
  });
});
