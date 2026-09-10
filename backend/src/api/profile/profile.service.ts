import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProfileService {
	constructor(private readonly prisma: PrismaService) { }

	async findMe(Id: string) {
    	const profile = await this.prisma.profile.findFirst({
			where: { userId :Id},
      		select: {
        		id: true,
        		firstName: true,
				lastName: true,
				gender: true,
  				birthDate: true,
  				deathDate: true,
  				bio: true,
  				photoUrl: true,
      		},
    	});
		// if (!profile)
        // 	throw new NotFoundException(`User with ID "${userId}" not found`);
		return profile;
  	}

	// Add to ProfileService
	async update(UserId: number, data: {
		firstName?: string;
		lastName?: string;
		gender?: string;
		birthDate?: string;
		deathDate?: string;
		motherId?: number | null;
		fatherId?: number | null;
		bio?: string | null;
	}) {
		return this.prisma.profile.update({
			where: { id : UserId},
			data: {
				firstName: data.firstName,
				lastName: data.lastName,
				gender: data.gender,
				birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
				deathDate: data.deathDate ? new Date(data.deathDate) : undefined,
				motherId: data.motherId ?? undefined,
				fatherId: data.fatherId ?? undefined,
				bio: data.bio ?? undefined,
			},
		});
	}

	async findAll() {
		// Include mother and father relations
		const persons = await this.prisma.profile.findMany({
			include: {
				mother: true,
				father: true,
			},
			orderBy: {
				birthDate: 'asc',
			},
		});

		// Map to expected frontend format (name, mother_name, father_name)
		return persons.map((p) => ({
			id: p.id,
			name: [p.firstName, p.lastName].filter(Boolean).join(' '),
			gender: p.gender,
			birth_date: p.birthDate,
			mother_name: p.mother ? [p.mother.firstName, p.mother.lastName].filter(Boolean).join(' ') : null,
			father_name: p.father ? [p.father.firstName, p.father.lastName].filter(Boolean).join(' ') : null,
		}));
	}

	async findOne(id: string) {
		// Convert string id to number
		const personId = Number(id);
		if (isNaN(personId)) return null;

		const profile = await this.prisma.profile.findUnique({
			where: { id: personId },
			include: {
				mother: true,
				father: true,
			},
		});
		if (!profile) return null;

		return {
			...profile,
			name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
			mother_name: profile.mother ? [profile.mother.firstName, profile.mother.lastName].filter(Boolean).join(' ') : null,
			father_name: profile.father ? [profile.father.firstName, profile.father.lastName].filter(Boolean).join(' ') : null,
		};
	}

	async create(data: {
		name: string; // frontend sends single name
		gender?: string;
		mother_id?: string; // frontend sends as string
		father_id?: string;
		birth_date?: string;
		tree_id?: number;
	}) {
		// Split name into firstName and lastName (simple, could be improved)
		const nameParts = data.name?.split(' ') || [];
		const firstName = nameParts[0] || '';
		const lastName = nameParts.slice(1).join(' ') || null;

		// Convert string IDs to numbers
		const motherId = data.mother_id ? Number(data.mother_id) : null;
		const fatherId = data.father_id ? Number(data.father_id) : null;

		const created = await this.prisma.profile.create({
			data: {
				firstName,
				lastName,
				gender: data.gender,
				motherId: motherId,
				fatherId: fatherId,
				birthDate: data.birth_date ? new Date(data.birth_date) : null,
			},
		});
		return created;
	}

	async remove(id: number) {
		return this.prisma.profile.delete({ where: { id } });
	}

	async getTree(rootId: number, treeId?): Promise<any> {
		// 1. Fetch all profiles in the same tree (to avoid multiple queries)
		const root = await this.prisma.profile.findUnique({
			where: { id: rootId },
			include: { treeMembers: true },
		});
		if (!root) throw new NotFoundException('Person not found');
		if (root.treeMembers.length === null) throw new NotFoundException('Person Profile is not in tree');
		const streeId = treeId ?? root.treeMembers[0].treeId;
		const allProfiles = await this.prisma.profile.findMany({
			where: { treeMembers: { some: { treeId: streeId } }, },
			select: {
				id: true,
				firstName: true,
				lastName: true,
				gender: true,
				birthDate: true,
				deathDate: true,
				motherId: true,
				fatherId: true,
			},
		});

		// 2. Build a map of id -> profile with children arrays
		const profileMap: Record<number, any> = {};
		allProfiles.forEach(p => {
			profileMap[p.id] = { ...p, children: [] };
		});

		// 3. Populate children arrays
		allProfiles.forEach(p => {
			if (p.motherId) {
				profileMap[p.motherId]?.children.push(p.id);
			}
			if (p.fatherId) {
				profileMap[p.fatherId]?.children.push(p.id);
			}
		});

		// 4. Recursive function to build tree from a root id
		function buildNode(id: number): any {
			const p = profileMap[id];
			if (!p) return null;
			return {
				id: p.id,
				firstName: p.firstName,
				lastName: p.lastName,
				gender: p.gender,
				birthDate: p.birthDate,
				deathDate: p.deathDate,
				children: (p.children || []).map((childId: number) => buildNode(childId)).filter(Boolean),
			};
		}

		return buildNode(rootId);
	}
<<<<<<< HEAD
}
=======
}
>>>>>>> jon2
