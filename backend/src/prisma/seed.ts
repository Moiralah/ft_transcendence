
import { PrismaClient } from '../generated';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
	// 1. Upsert a test user
	const user = await prisma.user.upsert({
		where: { email: 'admin@family.test' },
		update: {},
		create: {
			id: '00000000-0000-0000-0000-000000000001',
			username: 'admin',
			email: 'admin@family.test',
		},
	});

	// 2. Upsert a tree
	const tree = await prisma.tree.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: 'My Family Tree',
			description: 'Sample tree',
			ownerId: user.id,
		},
	});

	// 3. Create people
	const alice = await prisma.person.create({
		data: {
			firstName: 'Alice',
			lastName: 'Smith',
			gender: 'female',
			birthDate: new Date('1980-01-01'),
			treeId: tree.id,
		},
	});

	const bob = await prisma.person.create({
		data: {
			firstName: 'Bob',
			lastName: 'Smith',
			gender: 'male',
			birthDate: new Date('1979-05-12'),
			treeId: tree.id,
		},
	});

	await prisma.person.create({
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
}

main()
	.catch((e) => {
		console.error('❌ Seed failed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
