import { Test } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
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
});
