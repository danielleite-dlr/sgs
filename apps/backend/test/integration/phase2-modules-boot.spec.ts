import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';

/**
 * Phase 2 module skeletons boot test.
 *
 * Verifies that AppModule compiles and initializes with CatalogModule and
 * ClientsModule registered. Empty modules with no providers/resolvers MUST
 * still compile under NestJS — this smoke test confirms the DI graph is valid.
 *
 * Running: pnpm test:integration -- --testPathPattern phase2-modules-boot
 */
describe('Phase 2 module skeletons', () => {
  it('AppModule compiles with CatalogModule + ClientsModule registered', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication(new FastifyAdapter());
    await app.init();
    expect(app).toBeDefined();
    await app.close();
  }, 30000);

  // Regression: o SDL declara `scalar DateTime`, mas o GraphQLDateTimeISO do
  // graphql-scalars se chama "DateTimeISO". Sem renomear, qualquer operação que
  // declare uma variável `DateTime!` (a query da agenda) falha na validação.
  it('accepts operation variables typed as the SDL DateTime scalar', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: {
        query: `query ($startsAt: DateTime!, $endsAt: DateTime!) {
          appointments(startsAt: $startsAt, endsAt: $endsAt) { id }
        }`,
        variables: {
          startsAt: '2026-01-01T00:00:00.000Z',
          endsAt: '2026-01-02T00:00:00.000Z',
        },
      },
    });

    const body = res.json<{
      errors?: { extensions?: { code?: string } }[];
    }>();
    const codes = (body.errors ?? []).map((e) => e.extensions?.code);
    expect(codes).not.toContain('GRAPHQL_VALIDATION_FAILED');
    await app.close();
  }, 30000);
});
