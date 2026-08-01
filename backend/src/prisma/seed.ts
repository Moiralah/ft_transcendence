import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function seed() {
    await prisma.User.createMany({
        data: [
            {name: 'Alice', email: 'alice@example.com'},
            {name: 'Bob', email: 'bob@example.com'}
        ]
    });
}

seed().catch((e) => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});