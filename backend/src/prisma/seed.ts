import { PrismaClient } from '../generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Helper: generate a random 6-character alphanumeric code (uppercase)
function generateTreeCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function main() {
  // 1. Create a default user (admin)
  const user = await prisma.user.upsert({
    where: { email: 'admin@family.test' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      email: 'admin@family.test',
    },
  });

  // 2. Generate a unique code for the tree (try up to 5 times)
  let code = generateTreeCode();
  let existing = await prisma.tree.findUnique({ where: { code } });
  let attempts = 0;
  while (existing && attempts < 5) {
    code = generateTreeCode();
    existing = await prisma.tree.findUnique({ where: { code } });
    attempts++;
  }

  // 3. Upsert the default tree – include the required `code` field
  const tree = await prisma.tree.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'My Family Tree',
      description: 'Sample tree for testing',
      code: code,                    // ✅ required unique code
      owner: {
        connect: { id: user.id },    // ✅ relation instead of ownerId
      },
    },
  });

  // 4. Create profiles (family members)
  const alice = await prisma.profile.create({
    data: {
      firstName: 'Alice',
      lastName: 'Smith',
      gender: 'female',
      birthDate: new Date('1980-01-01'),
      treeId: tree.id,
    },
  });

  const bob = await prisma.profile.create({
    data: {
      firstName: 'Bob',
      lastName: 'Smith',
      gender: 'male',
      birthDate: new Date('1979-05-12'),
      treeId: tree.id,
    },
  });

  await prisma.profile.create({
    data: {
      firstName: 'Carol',
      lastName: 'Smith',
      gender: 'female',
      birthDate: new Date('2005-09-23'),
      motherId: alice.id,
      fatherId: bob.id,
      treeId: tree.id,
    },
  });

  console.log('✅ Seeding complete!');
  console.log(`📌 Tree code: ${code} (use this to join)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });