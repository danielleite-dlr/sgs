import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // System roles are seeded via SQL in the initial migration.
  // Per-organization data (seed orgs, demo users) is added in later plans.
  const count = await prisma.role.count({ where: { isSystem: true } });
  console.log(`[seed] system roles present: ${count}`);
}

main().finally(() => prisma.$disconnect());
