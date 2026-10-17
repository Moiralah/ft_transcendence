import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TreeService } from '../tree/tree.service';

const personName = (p?: { firstName: string; lastName: string | null } | null) =>
	p ? [p.firstName, p.lastName].filter(Boolean).join(' ') || '(no name)' : '(no profile)';

@Injectable()
export class AdminService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly trees: TreeService,
	) { }

	async stats() {
		const [byRole, suspended, mfa, trees, people] = await Promise.all([
			this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
			this.prisma.user.count({ where: { suspended: true } }),
			this.prisma.user.count({ where: { twoFactorEnabled: true } }),
			this.prisma.tree.count(),
			this.prisma.treeMember.count({ where: { role: 'HOLDER' } }),
		]);
		const roles = Object.fromEntries(byRole.map((r) => [r.role, r._count._all]));
		const users = byRole.reduce((sum, r) => sum + r._count._all, 0);
		return { users, roles, suspended, mfa, trees, people };
	}

	// Every tree, newest first: owner, how many people are drawn in it (HOLDER
	// rows) and how many real accounts belong to it (the other roles).
	async listTrees() {
		const trees = await this.prisma.tree.findMany({
			orderBy: { createdAt: 'desc' },
			select: {
				id: true, name: true, slug: true, description: true, isPublic: true, createdAt: true, updatedAt: true,
				owner: { select: { firstName: true, lastName: true, user: { select: { username: true, email: true } } } },
				members: { select: { role: true } },
			},
		});
		return trees.map(({ members, owner, ...t }) => ({
			...t,
			owner: { name: personName(owner), username: owner?.user?.username ?? null, email: owner?.user?.email ?? null },
			people: members.filter((m) => m.role === 'HOLDER').length,
			accounts: members.filter((m) => m.role !== 'HOLDER').length,
		}));
	}

	// One tree, read-only: the people in it (with parents and spouse by name) and
	// the accounts that belong to it with their tree role. No join code.
	async getTree(treeId: number) {
		const tree = await this.prisma.tree.findUnique({
			where: { id: treeId },
			select: {
				id: true, name: true, slug: true, description: true, isPublic: true, createdAt: true, updatedAt: true,
				owner: { select: { firstName: true, lastName: true, user: { select: { username: true, email: true } } } },
				members: {
					orderBy: { id: 'asc' },
					select: {
						id: true, role: true, claim: true, joinedAt: true,
						profile: {
							select: {
								id: true, firstName: true, lastName: true, gender: true, birthDate: true,
								mother: { select: { firstName: true, lastName: true } },
								father: { select: { firstName: true, lastName: true } },
								spouse: { select: { firstName: true, lastName: true } },
								spouseOf: { select: { firstName: true, lastName: true } },
								user: { select: { username: true, email: true, role: true } },
							},
						},
						link: { select: { profile: { select: { user: { select: { username: true } } } } } },
					},
				},
			},
		});
		if (!tree) throw new NotFoundException('Tree not found.');

		const { members, owner, ...rest } = tree;
		const people = members.filter((m) => m.role === 'HOLDER').map((m) => ({
			id: m.id,
			name: personName(m.profile),
			gender: m.profile?.gender ?? null,
			birthYear: m.profile?.birthDate ? m.profile.birthDate.getUTCFullYear() : null,
			mother: m.profile?.mother ? personName(m.profile.mother) : null,
			father: m.profile?.father ? personName(m.profile.father) : null,
			spouse: m.profile?.spouse || m.profile?.spouseOf ? personName(m.profile.spouse ?? m.profile.spouseOf) : null,
			claim: m.claim,
			claimedBy: m.link?.profile?.user?.username ?? null,
		}));
		const accounts = members.filter((m) => m.role !== 'HOLDER').map((m) => ({
			id: m.id,
			treeRole: m.role,
			name: personName(m.profile),
			username: m.profile?.user?.username ?? null,
			email: m.profile?.user?.email ?? null,
			joinedAt: m.joinedAt,
		}));
		return {
			...rest,
			owner: { name: personName(owner), username: owner?.user?.username ?? null, email: owner?.user?.email ?? null },
			people,
			accounts,
		};
	}

	// Same delete as the owner's (placeholder people cleaned up too); TreeService
	// already lets a site admin delete any tree.
	deleteTree(treeId: number, adminProfileId: number) {
		return this.trees.deleteTree(treeId, adminProfileId);
	}
}
