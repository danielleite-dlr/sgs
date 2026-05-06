import { PrismaClient } from '@prisma/client';

/**
 * Phase 2 Schema Smoke Test
 *
 * Verifies that all 10 new Prisma models generated from the Phase 2 migration
 * are accessible as delegates on the PrismaClient. No runtime DB writes are made —
 * this is a structural/TypeScript-compilation assertion.
 *
 * The test confirms:
 *   - All new model delegates exist and are functions/objects
 *   - Member.seniorityTier field is present in the TypeScript type (no TS error on
 *     the field reference at compile time means generate succeeded)
 *
 * Running: pnpm test:integration -- --testPathPattern phase2-schema-smoke
 */
describe('Phase 2 schema smoke — Prisma delegates', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DIRECT_URL! } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('has category delegate', () => {
    expect(typeof prisma.category.findMany).toBe('function');
  });

  it('has service delegate', () => {
    expect(typeof prisma.service.findMany).toBe('function');
  });

  it('has servicePricingVariant delegate', () => {
    expect(typeof prisma.servicePricingVariant.findMany).toBe('function');
  });

  it('has package delegate', () => {
    expect(typeof prisma.package.findMany).toBe('function');
  });

  it('has packageService delegate', () => {
    expect(typeof prisma.packageService.findMany).toBe('function');
  });

  it('has product delegate', () => {
    expect(typeof prisma.product.findMany).toBe('function');
  });

  it('has stockMovement delegate', () => {
    expect(typeof prisma.stockMovement.findMany).toBe('function');
  });

  it('has commissionRule delegate', () => {
    expect(typeof prisma.commissionRule.findMany).toBe('function');
  });

  it('has client delegate', () => {
    expect(typeof prisma.client.findMany).toBe('function');
  });

  it('has notification delegate', () => {
    expect(typeof prisma.notification.findMany).toBe('function');
  });

  it('member model includes seniorityTier — delegate accepts seniorityTier in select', async () => {
    // Structural check: TypeScript would fail at compile time if seniorityTier
    // does not exist on the Member model. Runtime confirms no DB error.
    const members = await prisma.member.findMany({
      select: { id: true, seniorityTier: true },
      take: 1,
    });
    // Result is empty array (no data in test DB yet) — shape is correct
    expect(Array.isArray(members)).toBe(true);
  });
});
