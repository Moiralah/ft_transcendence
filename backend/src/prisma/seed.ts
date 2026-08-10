// import { PrismaClient } from '../generated';

// const prisma = new PrismaClient();
// async function seed() {
//     await prisma.User.createMany({
//         data: [
//             {name: 'Alice', email: 'alice@example.com'},
//             {name: 'Bob', email: 'bob@example.com'}
//         ]
//     });
// }

// seed().catch((e) => {
//     console.error(e);
//     process.exit(1);
// }).finally(async () => {
//     await prisma.$disconnect();
// });

import { PrismaClient } from '../generated';

const prisma = new PrismaClient({});

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: 'user1', email: 'alice@example.com', username: 'alice' },
      { id: 'user2', email: 'bob@example.com', username: 'bob' },
    ],
  });
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());