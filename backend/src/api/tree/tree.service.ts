import {
	Injectable, Logger, NotFoundException, ForbiddenException,
	BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService, malaysiaTime } from '../../mail/mail.service';
import { broadcastAudit, treeChannel } from './tree-realtime';

const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER', 'JOINER'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const displayName = (
	p: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string =>
	[p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || 'Unknown';

@Injectable()
export class TreeService {
	private readonly logger = new Logger(TreeService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly mail: MailService,
	) { }

	// TREE CREATION
	// What will happen?
	// need to set Tree name, tree code, owner, create root node
	// each node have a made-up profile(role HOLDER) attached with tree member table all made-up node stay in the tree page only
	// every profile with user that join the tree will have their own tree member table
	// when they claim one node. their profile will be linked via Tree member table
	// the frontend node will show their user.profile data instead of made-up.profile
	// Onwer can delete tree or transfer ownership to admin
	// Admin can do anything, change root profile
	// Member can approved claim profile add new made-up profile delete profile
	// Joiner can claim node and view only - once node is claim he become Member
	// Member can make and update made-up profile for their own father-mother-children only
	// Hanging node profile that is not attached link to anyone in the tree will not be shown in the tree map
	// Anyone who leave the tree will unlink their profile from Tree Member. made-up profile will re-surface on that node
	// Tree starting point will be root profile

	// AuditLog.profileId is enough on its own — User.profileId is one-to-one,
	// so it always resolves back to the acting user without a separate
	// userId column.

	// Every audit row goes through here so it also reaches the tree's live
	// notifications (see tree-realtime.ts). `db` is this.prisma or a
	// transaction; the row is always the last write in its transaction.
	private async logAudit(
		db: Pick<PrismaService, 'auditLog'>,
		args: { data: { treeId: number; profileId: number; action: string; details?: string } },
	) {
		const { profile, ...log } = await db.auditLog.create({
			...args,
			include: { profile: { select: { firstName: true, lastName: true } } },
		});
		const actorName = `${profile.firstName} ${profile.lastName ?? ''}`.trim();
		broadcastAudit({ id: log.id, treeId: log.treeId, actorName, action: log.action, details: log.details, createdAt: log.createdAt });
		return log;
	}

	private async profileNameById(
		db: Pick<PrismaService, 'profile'>,
		profileId: number,
	): Promise<string> {
		const p = await db.profile.findUnique({
			where: { id: profileId },
			select: { firstName: true, lastName: true },
		});
		return displayName(p);
	}

	// Someone's details or photo were saved (ProfileController). Profile edits
	// don't go through this service, so without this no audit row is written
	// and other members' open canvases never hear about it. One row per tree
	// the person is in; the save itself has already happened, so a failure
	// here is only logged.
	async logProfileUpdate(actorProfileId: number, profileId: number, what: 'details' | 'photo') {
		try {
			const nodes = await this.prisma.treeMember.findMany({
				where: { profileId, treeId: { not: null } },
				select: { treeId: true },
			});
			const treeIds = [...new Set(nodes.map((n) => n.treeId!))];
			if (treeIds.length === 0) return;
			const name = await this.profileNameById(this.prisma, profileId);
			for (const treeId of treeIds) {
				await this.logAudit(this.prisma, {
					data: { treeId, profileId: actorProfileId, action: 'UPDATE_PROFILE', details: `Updated ${name}'s ${what}` },
				});
			}
		} catch (e) {
			this.logger.warn(`Profile ${profileId} saved, but the tree update wasn't logged: ${(e as Error)?.message}`);
		}
	}

	private generateTreeCode(): string {
		return Math.random().toString(36).substring(2, 8).toUpperCase();
	}

	private generateSlug(name: string): string {
		// "My Family Tree" → "my-family-tree-a4f9c2"
		const base = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 32) || 'tree';
		const suffix = randomBytes(3).toString('hex');  // 6 hex chars
		return `${base}-${suffix}`;
	}

	async createTree(profileId: number, name: string, description?: string) {

		let code: string;
		do {
			code = this.generateTreeCode();
		} while (await this.prisma.tree.findUnique({ where: { code } }));

		let slug: string;
		do {
			slug = this.generateSlug(name);
		} while (await this.prisma.tree.findUnique({ where: { slug } }));
		// Tree.rootId -> TreeMember.id and TreeMember.treeId -> Tree.id form a
		// cycle, so we can't nest-create both sides in a single Tree.create().
		// Do it in three steps instead: blank profile -> root TreeMember
		// (treeId still null) -> Tree (referencing rootId) -> patch treeId back
		// onto the root row.
		return this.prisma.$transaction(async (tx) => {
			const rootProfile = await tx.profile.create({
				data: { firstName: 'Unknown' },
			});

			const rootMember = await tx.treeMember.create({
				data: { role: 'HOLDER', profileId: rootProfile.id },
			});

			const tree = await tx.tree.create({
				data: {
					name,
					slug,
					code,
					description,
					ownerId: profileId,
					rootId: rootMember.id,
				},
			});

			await tx.treeMember.update({
				where: { id: rootMember.id },
				data: { treeId: tree.id },
			});

			// Owner's own membership row — separate from the root placeholder.
			await tx.treeMember.create({
				data: { profileId, treeId: tree.id, role: 'ADMIN' },
			});

			await this.logAudit(tx, {
				data: {
					treeId: tree.id,
					profileId,
					action: 'CREATE_TREE',
					// No join code here: audit rows reach browsers as live notifications.
					details: `Created tree "${name}"`,
				},
			});

			return tx.tree.findUnique({
				where: { id: tree.id },
				include: {
					owner: true,
					root: { include: { profile: true } },
					members: { include: { profile: true } },
				},
			});
		});
	}

	async joinTree(profileId: number, name: string, code: string) {
		// Also checked by JoinTreeDto: only plain strings may reach the where
		// clause, or { "not": "" } as the code would match any tree.
		if (typeof name !== 'string' || typeof code !== 'string' || !name || !code) {
			throw new BadRequestException('Tree name and code are required.');
		}
		// Typed by hand from the tree banner: forgive spaces, a lowercase code and
		// the name's case. Codes are unique and always uppercase.
		const tree = await this.prisma.tree.findFirst({
			where: {
				name: { equals: name.trim(), mode: 'insensitive' },
				code: code.trim().toUpperCase(),
			},
		});
		if (!tree) {
			throw new NotFoundException('Tree not found. Check name and  JOIN code.');
		}

		const existing = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId, treeId: tree.id } },
		});
		if (existing) {
			throw new ForbiddenException('You are already a member of this tree.');
		}

		const member = await this.prisma.treeMember.create({
			data: { profileId, treeId: tree.id, role: 'JOINER' },
			// Not the whole tree: its join code is for admins to hand out.
			include: { profile: true, tree: { select: { id: true, name: true, slug: true } } },
		});

		await this.logAudit(this.prisma, {
			data: {
				treeId: tree.id,
				profileId,
				action: 'JOIN_TREE',
				details: `Joined tree "${tree.name}" as JOINER`,
			},
		});

		return member;
	}

	// SEARCHING PUBLIC TREE - API FOR SEARCH BUTTON
	// `code` is deliberately excluded from both the filter and the response —
	// it's a private join gate, not something that should be text-searchable
	// or visible before someone actually joins. The `include`/`select` below
	// is a "search result card" preview: owner + up to 5 member profiles, so
	// the frontend can render a result row without a second request per tree.
	async searchTree(query: string) {
		return this.prisma.tree.findMany({
			where: {
				name: { contains: query, mode: 'insensitive' },
				isPublic: true,
			},
			// A card, not the tree: no member profiles (birth dates, bios of
			// people in someone else's family) and no internal user ids.
			select: {
				id: true,
				name: true,
				slug: true,
				description: true,
				isPublic: true,
				createdAt: true,
				owner: {
					select: { firstName: true, lastName: true, user: { select: { username: true } } },
				},
				_count: { select: { members: { where: { role: { not: 'HOLDER' } } } } },
			},
		});
	}

	// Powers a "My Trees" dashboard: every tree this profile belongs to,
	// plus its role in each one.
	async getUserTrees(profileId: number) {
		const memberships = await this.prisma.treeMember.findMany({
			where: { profileId },
			include: {
				tree: {
					include: {
						owner: { include: { user: { select: { username: true } } } },
						members: {
							where: { role: { not: 'HOLDER' } },
							select: { id: true },
						},
					},
				},
			},
		});

		return memberships
			.filter((m) => m.tree)
			.map((m) => ({
				...this.codeForAdminsOnly(m.tree!, m.role),
				profileRole: m.role,
				userCount: m.tree?.members.length ?? 0,
			}));
	}

	async getTreeMember(treeId: number, profileId: number) {
		const requester = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId, treeId } },
		});
		if (!requester) {
			throw new ForbiddenException('You do not have access to this tree.');
		}

		const memberships = await this.prisma.treeMember.findMany({
			where: { treeId },
			include: {
				profile: { select: this.memberProfileSelect },
				link: { include: { profile: { select: this.memberProfileSelect } } }
			},
			orderBy: { joinedAt: 'asc' },
		});

		return memberships.map((m) => this.mapMemberRow(m));
	}

	// Tree detail page. Only ever reached once the frontend already has a
	// treeId — from "My Trees" or a search result the user has since joined —
	// never from a raw typed-in code, so there's no code-guessing surface here.
	async getTreeById(treeId: number, profileId: number) {
		const member = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId, treeId } },
		});

		if (!member) {
			throw new ForbiddenException('You do not have access to this tree.');
		}

		const tree = await this.prisma.tree.findUnique({
			where: { id: treeId },
			include: {
				owner: true,
				root: { include: { profile: true, link: { include: { profile: true } } } },
				members: {
					include: {
						profile: true,
						// The claimed real profile, if this member row is a HOLDER
						// with a pending or accepted claim on it.
						link: { include: { profile: true } },
					},
				},
			},
		});

		if (!tree) {
			throw new NotFoundException('Tree not found.');
		}
		return {
			...this.codeForAdminsOnly(tree, member.role),
			userRole: member.role,
			// Members only, like the rest of this response: see tree-realtime.ts.
			realtimeChannel: treeChannel(tree.id),
		};
	}

	async getTreeBySlug(slug: string, profileId: number) {
		const tree = await this.prisma.tree.findUnique({
			where: { slug },
			select: { id: true },
		});
		if (!tree) {
			throw new NotFoundException('Tree not found');
		}
		const member = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId, treeId: tree.id } },
		});

		if (!member) {
			throw new ForbiddenException('You do not have access to this tree.');
		}

		const fulltree = await this.prisma.tree.findUnique({
			where: { id: tree.id },
			include: {
				owner: true,
				root: { include: { profile: true, link: { include: { profile: true } } } },
				members: {
					include: {
						profile: true,
						// The claimed real profile, if this member row is a HOLDER
						// with a pending or accepted claim on it.
						link: { include: { profile: true } },
					},
				},
			},
		});

		if (!fulltree) {
			throw new NotFoundException('Tree not found.');
		}
		return {
			...this.codeForAdminsOnly(fulltree, member.role),
			userRole: member.role,
			// Members only, like the rest of this response: see tree-realtime.ts.
			realtimeChannel: treeChannel(fulltree.id),
		};
	}

	// The join code is for the people who invite: tree admins (the owner is
	// one). Other members get the tree without it.
	private codeForAdminsOnly<T extends { code: string | null }>(tree: T, role: string): T | Omit<T, 'code'> {
		if (role === 'ADMIN') return tree;
		const { code: _code, ...rest } = tree;
		return rest;
	}

	async update(
		treeId: number,
		requesterProfileId: number,
		data: {
			name?: string;
			description?: string;
			isPublic?: boolean;
		},
	) {
		const tree = await this.prisma.tree.findUnique({
			where: { id: treeId },
		});

		if (!tree) {
			throw new NotFoundException('Tree not found.');
		}

		// Only owner can update tree settings
		if (tree.ownerId !== requesterProfileId) {
			throw new ForbiddenException(
				'Only the tree owner can update tree details.',
			);
		}

		const updatedTree = await this.prisma.tree.update({
			where: { id: treeId },
			data: {
				name: data.name,
				description: data.description,
				isPublic: data.isPublic,
			},
		});

		await this.logAudit(this.prisma, {
			data: {
				treeId,
				profileId: requesterProfileId,
				action: 'UPDATE_TREE',
				details: `Updated tree "${updatedTree.name}"`,
			},
		});

		return updatedTree;
	}

	private readonly memberProfileSelect = {
		id: true,
		firstName: true,
		lastName: true,
		photoUrl: true,
		gender: true,
		birthDate: true,
		spouseId: true,
		fatherId: true,
		motherId: true,
		childrenAsMother: { select: { id: true } },
		childrenAsFather: { select: { id: true } },
	} as const;

	private mapMemberRow(m: any) {
		const display = m.claim === 'ACCEPTED' && m.link?.profile ? m.link.profile : m.profile;
		return {
			id: m.id,
			profileId: m.profileId,
			treeId: m.treeId,
			role: m.role,
			claim: m.claim,
			joinedAt: m.joinedAt,
			firstName: display?.firstName ?? '',
			lastName: display?.lastName ?? '',
			photoUrl: display?.photoUrl ?? null,
			gender: display?.gender ?? null,
			birthDate: display?.birthDate ?? null,
			linkId: m.linkId,
			spouseId: m.profile?.spouseId ?? null,
			motherId: m.profile?.motherId ?? null,
			fatherId: m.profile?.fatherId ?? null,
			childrenIds: [
				...new Set([
					...(m.profile?.childrenAsMother ?? []).map((c) => c.id),
					...(m.profile?.childrenAsFather ?? []).map((c) => c.id),
				]),
			],
		};
	}

	async addChildNode(
		treeId: number,
		requesterProfileId: number,
		parentProfileId: number,
	) {
		const requesterMembership = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId: requesterProfileId, treeId } },
		});

		if (!requesterMembership ||
			!['ADMIN', 'MEMBER'].includes(requesterMembership.role)
		) {
			throw new ForbiddenException('You do not have permission to add children in this tree.');
		}

		const isPrivileged = ['ADMIN', 'MEMBER'].includes(requesterMembership.role);

		if (!isPrivileged) {
			const ownProfileId = await this.getOwnClaimedProfileId(treeId, requesterMembership.id);
			if (ownProfileId === null || ownProfileId !== parentProfileId) {
				throw new ForbiddenException('As a member, you can only add a child to your own node.');
			}
		}

		const parentMembership = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId: parentProfileId, treeId } },
		});

		if (!parentMembership) {
			throw new NotFoundException('That profile is not part of this tree.');
		}

		return this.prisma.$transaction(async (tx) => {
			let parent = await tx.profile.findUnique({ where: { id: parentProfileId } });
			if (!parent) {
				throw new NotFoundException('Parent profile not found.');
			}

			let spouseId = parent.spouseId;
			let spouseCreated = false
			if (!spouseId) {
				const spouse = await tx.profile.create({
					data: { firstName: 'New Spouse', spouseId: parentProfileId },
				});
				await tx.profile.update({
					where: { id: parentProfileId },
					data: { spouseId: spouse.id },
				});
				await tx.treeMember.create({
					data: { role: 'HOLDER', profileId: spouse.id, treeId },
				});
				spouseId = spouse.id;
				spouseCreated = true;
			}

			// Gender-slot assignment: if the parent's gender tells us which slot
			// they belong in, use it. Otherwise (unset/other), the parent
			// defaults to the father slot and the spouse to the mother slot.
			const parentIsMother = parent.gender?.toUpperCase() === 'FEMALE';
			const motherId = parentIsMother ? parentProfileId : spouseId;
			const fatherId = parentIsMother ? spouseId : parentProfileId;

			const child = await tx.profile.create({
				data: { firstName: 'New Child', motherId, fatherId },
			});

			await tx.treeMember.create({
				data: { profileId: child.id, treeId, role: 'HOLDER' },
			});

			const touchedProfileIds = [
				parentProfileId,
				child.id,
				...(spouseCreated ? [spouseId] : []),
			];

			const rows = await tx.treeMember.findMany({
				where: { treeId, profileId: { in: touchedProfileIds } },
				include: {
					profile: { select: this.memberProfileSelect },
					link: { include: { profile: { select: this.memberProfileSelect } } },
				},
			});

			await this.logAudit(tx, {
				data: {
					treeId,
					profileId: requesterProfileId,
					action: 'ADD_CHILD',
					details: `Added a child under profile ${displayName(parent)}`,
				},
			});

			return rows.map((r) => this.mapMemberRow(r));
		});
	}

	async addSpouseNode(
		treeId: number,
		requesterProfileId: number,
		partnerProfileId: number,
	) {
		const requesterMembership = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId: requesterProfileId, treeId } },
		});

		if (!requesterMembership ||
			!['ADMIN', 'MEMBER'].includes(requesterMembership.role)
		) {
			throw new ForbiddenException('You do not have permission to add spouse in this tree.');
		}

		const isPrivileged = ['ADMIN', 'MEMBER'].includes(requesterMembership.role);

		if (!isPrivileged) {
			const ownProfileId = await this.getOwnClaimedProfileId(treeId, requesterMembership.id);
			if (ownProfileId === null || ownProfileId !== partnerProfileId) {
				throw new ForbiddenException('As a member, you can only add spouse to your own node.');
			}
		}

		const partnerMembership = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId: partnerProfileId, treeId } },
		});
		if (!partnerMembership) {
			throw new NotFoundException('That profile is not part of this tree.');
		}

		return this.prisma.$transaction(async (tx) => {
			let partner = await tx.profile.findUnique({ where: { id: partnerProfileId } });
			if (!partner) {
				throw new NotFoundException('Partner profile not found.');
			}
			if (partner.spouseId) {
				throw new BadRequestException('Spouse already exist. Only 1 spouse allowed per person');
			}

			const spouse = await tx.profile.create({
				data: { firstName: 'New Spouse', spouseId: partnerProfileId },
			});
			await tx.profile.update({
				where: { id: partnerProfileId },
				data: { spouseId: spouse.id },
			});
			await tx.treeMember.create({
				data: { role: 'HOLDER', profileId: spouse.id, treeId },
			});

			const rows = await tx.treeMember.findMany({
				where: { treeId, profileId: { in: [partnerProfileId, spouse.id] } },
				include: {
					profile: { select: this.memberProfileSelect },
					link: { include: { profile: { select: this.memberProfileSelect } } },
				},
			});

			await this.logAudit(tx, {
				data: {
					treeId,
					profileId: requesterProfileId,
					action: 'ADD_SPOUSE',
					details: `Added a spouse for ${displayName(partner)}`,
				},
			});

			return rows.map((r) => this.mapMemberRow(r));
		});
	}

	// A MEMBER's "own node" is whichever HOLDER node they've claimed (their
	// linked TreeMember row, once accepted) — not their raw signup profileId,
	// since that's not necessarily anywhere in this tree's family graph.
	private async getOwnClaimedProfileId(treeId: number, requesterMemberId: number): Promise<number | null> {
		const claimedHolder = await this.prisma.treeMember.findFirst({
			where: { treeId, linkId: requesterMemberId, claim: 'ACCEPTED' },
		});
		return claimedHolder?.profileId ?? null;
	}

	private async assertMemberOrAdmin(treeId: number, profileId: number) {
		const membership = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId, treeId } },
		});
		if (!membership || !['ADMIN', 'MEMBER'].includes(membership.role)) {
			throw new ForbiddenException('Only admins or Members can do this.');
		}
	}

	// Member/Admin only — remove a placeholder node that isn't claimed,
	// isn't the tree's root, and isn't load-bearing for anyone else's edges.
	async deleteProfileNode(treeId: number, requesterProfileId: number, targetMemberId: number) {
		await this.assertMemberOrAdmin(treeId, requesterProfileId);

		const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });
		if (!tree) {
			throw new NotFoundException('Tree not found.');
		}

		const target = await this.prisma.treeMember.findUnique({ where: { id: targetMemberId } });
		if (!target || target.treeId !== treeId) {
			throw new NotFoundException('Profile node not found in this tree.');
		}
		if (target.role !== 'HOLDER') {
			throw new ForbiddenException('Only made-up (placeholder) profiles can be deleted this way.');
		}
		if (target.id === tree.rootId) {
			throw new ForbiddenException("Cannot delete the tree's root profile.");
		}

		const childCount = await this.prisma.profile.count({
			where: { OR: [{ motherId: target.profileId! }, { fatherId: target.profileId! }] },
		});
		if (childCount > 0) {
			throw new ForbiddenException('This profile still has children linked to it — reassign them first.');
		}

		return this.prisma.$transaction(async (tx) => {
			const targetName = await this.profileNameById(tx, target.profileId!);
			if (target.linkId) {
				const linkedMember = await tx.treeMember.findUnique({ where: { id: target.linkId } });

				if (linkedMember) {
					// Demote MEMBER -> JOINER if they were promoted by the accepted claim.
					if (linkedMember.role === 'MEMBER') {
						await tx.treeMember.update({
							where: { id: linkedMember.id },
							data: { role: 'JOINER' },
						});
					}
					// Clear their link if it still points back at this holder.
					if (linkedMember.linkId === targetMemberId) {
						await tx.treeMember.update({
							where: { id: linkedMember.id },
							data: { linkId: null },
						});
					}
				}
			}

			await tx.treeMember.delete({ where: { id: targetMemberId } });
			await tx.profile.delete({ where: { id: target.profileId! } });

			await this.logAudit(tx, {
				data: {
					treeId,
					profileId: requesterProfileId,
					action: 'DELETE_PROFILE',
					details: `Deleted ${targetName}`,
				},
			});

			return {
				message: 'Profile node deleted.',
				deletedMemberId: targetMemberId,
				deletedProfileId: target.profileId,
				treeId,
			};
		});
	}

	// --- Claiming a placeholder node ---
	// The HOLDER TreeMember row (and its placeholder Profile, with all its
	// family edges) is never deleted or merged. Claiming just points the
	// HOLDER row's linkId at the claimant's own TreeMember row — the
	// frontend renders link.profile instead of profile once claim === ACCEPTED.

	async requestClaim(treeId: number, requesterProfileId: number, holderMemberId: number) {
		const requesterMember = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId: requesterProfileId, treeId } },
		});
		if (!requesterMember) {
			throw new ForbiddenException('Join the tree before claiming a profile.');
		}

		if (requesterMember.linkId) {
			throw new ForbiddenException('You already have an active claim. Unclaim it first.');
		}

		const holder = await this.prisma.treeMember.findUnique({ where: { id: holderMemberId } });
		if (!holder || holder.treeId !== treeId || holder.role !== 'HOLDER') {
			throw new NotFoundException('Placeholder profile not found in this tree.');
		}
		if (holder.claim === 'PENDING' || holder.claim === 'ACCEPTED') {
			throw new ForbiddenException('This profile already has a pending or accepted claim.');
		}

		// The tree's owner claiming a person in their own tree is accepted
		// straight away: they're the one who would approve it. Everyone else's
		// claim waits for approval.
		const tree = await this.prisma.tree.findUnique({ where: { id: treeId }, select: { ownerId: true } });
		const byOwner = tree?.ownerId === requesterProfileId;

		return this.prisma.$transaction(async (tx) => {

			const holderName = await this.profileNameById(tx, holder.profileId!);

			await tx.treeMember.update({
				where: { id: requesterMember.id },
				data: { linkId: holderMemberId },
			});

			const updated = await tx.treeMember.update({
				where: { id: holderMemberId },
				data: { linkId: requesterMember.id, claim: byOwner ? 'ACCEPTED' : 'PENDING' },
				include: { profile: true, link: { include: { profile: true } } },
			});

			await this.logAudit(tx, {
				data: {
					treeId,
					profileId: requesterProfileId,
					action: byOwner ? 'APPROVE_CLAIM' : 'REQUEST_CLAIM',
					details: byOwner
						? `Claimed ${holderName}`
						: `Requested to claim ${holderName}`,
				},
			});

			return updated;
		});
	}

	async approveClaim(treeId: number, approverProfileId: number, holderMemberId: number) {
		await this.assertMemberOrAdmin(treeId, approverProfileId);

		const holder = await this.prisma.treeMember.findUnique({ where: { id: holderMemberId } });
		if (!holder || holder.treeId !== treeId) {
			throw new NotFoundException('Placeholder profile not found in this tree.');
		}
		if (holder.claim !== 'PENDING' || !holder.linkId) {
			throw new ForbiddenException('There is no pending claim on this profile.');
		}

		return this.prisma.$transaction(async (tx) => {

			const holderName = await this.profileNameById(tx, holder.profileId!);

			const linkedMember = await tx.treeMember.findUnique({ where: { id: holder.linkId! } });
			if (!linkedMember) {
				throw new NotFoundException('Linked member not found.');
			}

			// Only promote JOINER -> MEMBER.
			// ADMIN / Member keep their role.
			if (linkedMember.role === 'JOINER') {
				await tx.treeMember.update({
					where: { id: linkedMember.id },
					data: { role: 'MEMBER' },
				});
			}

			const updated = await tx.treeMember.update({
				where: { id: holderMemberId },
				data: { claim: 'ACCEPTED' },
				include: { profile: true, link: { include: { profile: true } } },
			});

			await this.logAudit(tx, {
				data: {
					treeId,
					profileId: approverProfileId,
					action: 'APPROVE_CLAIM',
					details: `Approved claim on ${holderName}`,
				},
			});

			return updated;
		});
	}

	async rejectClaim(treeId: number, approverProfileId: number, holderMemberId: number) {
		await this.assertMemberOrAdmin(treeId, approverProfileId);

		const holder = await this.prisma.treeMember.findUnique({ where: { id: holderMemberId } });
		if (!holder || holder.treeId !== treeId) {
			throw new NotFoundException('Placeholder profile not found in this tree.');
		}
		if (holder.claim !== 'PENDING') {
			throw new ForbiddenException('There is no pending claim on this profile.');
		}

		const linkedMemberId = holder.linkId;

		// Free the node back up rather than locking it permanently — a fresh
		// request flips it back to PENDING, so this doesn't block a retry
		// (by this or another claimant).
		return this.prisma.$transaction(async (tx) => {

			const holderName = await this.profileNameById(tx, holder.profileId!);

			if (linkedMemberId) {
				await tx.treeMember.updateMany({
					where: { id: linkedMemberId, linkId: holderMemberId },
					data: { linkId: null },
				});
			}

			const updated = await tx.treeMember.update({
				where: { id: holderMemberId },
				data: { linkId: null, claim: 'EMPTY' },
			});

			await this.logAudit(tx, {
				data: {
					treeId,
					profileId: approverProfileId,
					action: 'REJECT_CLAIM',
					details: `Rejected claim on ${holderName}`,
				},
			});

			return updated;
		});
	}

	async unclaim(treeId: number, requesterProfileId: number, holderMemberId: number) {
		// 1. Look up the requester's own membership row in this tree.
		const requesterMember = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId: requesterProfileId, treeId } },
		});
		if (!requesterMember) {
			throw new ForbiddenException('You are not a member of this tree.');
		}

		// 2. Load the placeholder being unclaimed.
		const holder = await this.prisma.treeMember.findUnique({
			where: { id: holderMemberId },
		});
		if (!holder || holder.treeId !== treeId) {
			throw new NotFoundException('Placeholder profile not found in this tree.');
		}

		const isPending = holder.claim === 'PENDING';
		const isAccepted = holder.claim === 'ACCEPTED';

		if ((!isPending && !isAccepted) || !holder.linkId) {
			throw new ForbiddenException('Profile has no pending or accepted claim to remove.');
		}

		// 3. Authorization:
		//    - The claimant can unclaim their own slot.
		//    - ADMIN / Member can unclaim any slot.
		const isClaimant = holder.linkId === requesterMember.id;
		const isMemberOrAdmin = ['ADMIN', 'MEMBER'].includes(requesterMember.role);

		if (!isClaimant && !isMemberOrAdmin) {
			throw new ForbiddenException('You can only unclaim a slot you claimed yourself.');
		}

		const linkedMemberId = holder.linkId;

		return this.prisma.$transaction(async (tx) => {

			const holderName = await this.profileNameById(tx, holder.profileId!);
			// 4. If the claim was accepted, the claimant may have been promoted
			//    from JOINER to MEMBER. Revert that.
			//    ADMIN / Member keep their role.

			if (isAccepted && linkedMemberId) {
				const linkedMember = await tx.treeMember.findUnique({
					where: { id: linkedMemberId },
				});
				if (linkedMember && linkedMember.role === 'MEMBER') {
					await tx.treeMember.update({
						where: { id: linkedMember.id },
						data: { role: 'JOINER' },
					});
				}
			}

			if (linkedMemberId) {
				await tx.treeMember.updateMany({
					where: { id: linkedMemberId, linkId: holderMemberId },
					data: { linkId: null },
				});
			}

			// 5. Clear the link on the placeholder.
			const updated = await tx.treeMember.update({
				where: { id: holderMemberId },
				data: { linkId: null, claim: 'EMPTY' },
				include: { profile: true, link: { include: { profile: true } } },
			});

			// 6. Audit log.
			await this.logAudit(tx, {
				data: {
					treeId,
					profileId: requesterProfileId,
					action: isAccepted ? 'UNCLAIM' : 'REJECT_CLAIM',
					details: isAccepted
						? `Unclaimed ${holderName}`
						: `Withdrew pending claim on ${holderName}`,
				},
			});

			return updated;
		});
	}

	async kickUser(treeId: number, requesterProfileId: number, targetProfileId: number) {
		// 1. Look up the requester's own membership row in this tree.
		const requesterMember = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId: requesterProfileId, treeId } },
		});
		if (!requesterMember) {
			throw new ForbiddenException('You are not a member of this tree.');
		}

		// 2. Authorize: only ADMIN can kick someone else.
		if (!['ADMIN'].includes(requesterMember.role)) {
			throw new ForbiddenException('Only admins can kick members.');
		}

		// 3. Load the tree + target.
		const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });
		if (!tree) throw new NotFoundException('Tree not found.');

		if (tree.ownerId === targetProfileId) {
			throw new ForbiddenException('Cannot kick the tree owner.');
		}

		const target = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId: targetProfileId, treeId } },
		});
		if (!target) {
			throw new NotFoundException('That user is not in this tree.');
		}

		return this.prisma.$transaction(async (tx) => {

			const kickedName = await this.profileNameById(tx, target.profileId!);
			// 5. If the target had claimed a placeholder, release it.
			const claimedHolder = await tx.treeMember.findUnique({
				where: { linkId: target.id },
			});

			let freedHolder = null;

			if (claimedHolder) {
				// Clear the placeholder: drop the link, reset claim state.
				freedHolder = await tx.treeMember.update({
					where: { id: claimedHolder.id },
					data: { linkId: null, claim: 'EMPTY' },
					include: {
						profile: { select: this.memberProfileSelect },
						link: { include: { profile: { select: this.memberProfileSelect } } },
					},
				});
			}

			// 6. Delete the target's TreeMember row.
			await tx.treeMember.delete({ where: { id: target.id } });

			// 7. Audit log.
			await this.logAudit(tx, {
				data: {
					treeId,
					profileId: requesterProfileId,
					action: 'KICK_USER',
					details: `Kicked ${kickedName} from the tree`,
				},
			});

			// 8. Return both the removed row and the freed holder (if any),
			return {
				message: 'User removed from tree.',
				kickedMemberId: target.id,
				kickedProfileId: target.profileId,
				freedHolder: freedHolder ? this.mapMemberRow(freedHolder) : null,
			};
		});
	}

	async leaveTree(profileId: number, treeId: number) {
		const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });
		if (!tree) {
			throw new NotFoundException('Tree not found.');
		}
		// Bug fix: was comparing tree.ownerId (a Profile id) against a user id.
		if (tree.ownerId === profileId) {
			throw new ForbiddenException('Owner cannot leave their own tree. Transfer ownership first.');
		}

		const member = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId, treeId } },
		});
		if (!member) {
			throw new NotFoundException('You are not a member of this tree.');
		}

		return this.prisma.$transaction(async (tx) => {
			// If this member had claimed a placeholder node, unlink it so the
			// made-up profile re-surfaces on that node.
			const claimedHolder = await tx.treeMember.findUnique({ where: { linkId: member.id } });
			if (claimedHolder) {
				await tx.treeMember.update({
					where: { id: claimedHolder.id },
					data: { linkId: null, claim: 'EMPTY' },
				});
			}

			await tx.treeMember.delete({ where: { id: member.id } });

			await this.logAudit(tx, {
				data: {
					treeId,
					profileId,
					action: 'LEAVE_TREE',
					details: `Left the tree`,
				},
			});

			return { message: 'Successfully left the tree.' };
		});
	}

	/**
	 * Global platform admin — role on User, not TreeMember.
	 * Used to let superusers bypass per-tree permission checks.
	 */
	// siteAdmin: called from the admin console (AdminService), whose accounts
	// have no profile; the route itself is admin-only.
	async deleteTree(treeId: number, requesterProfileId: number | null, siteAdmin = false) {
		const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });
		if (!tree) throw new NotFoundException('Tree not found.');

		// Only the owner and global admin can delete.
		if (tree.ownerId !== requesterProfileId && !siteAdmin) {
			throw new ForbiddenException('Only the tree owner and global admin can delete this tree.');
		}

		const result = await this.prisma.$transaction(async (tx) => {
			// 1. Collect the placeholder Profile ids belonging to this tree.
			//    "Placeholder" = userId IS NULL (no real user attached).
			const memberRows = await tx.treeMember.findMany({
				where: { treeId },
				select: { profileId: true },
			});

			const candidateProfileIds = memberRows
				.map((m) => m.profileId)
				.filter((id): id is number => id !== null);

			// 2. Of those, keep only the ones that are not user-owned and live
			//    only in this tree. A deleted user's old profile also has no
			//    userId, but it can still be in, own, or have audit entries in
			//    other trees; deleting it would remove it there too, or fail on
			//    the foreign keys and roll back the whole delete.
			const placeholders = await tx.profile.findMany({
				where: {
					id: { in: candidateProfileIds },
					userId: null,
					treeMembers: { every: { treeId } },
					ownedTrees: { none: { id: { not: treeId } } },
					auditLogs: { none: { treeId: { not: treeId } } },
				},
				select: { id: true },
			});
			const deletableProfileIds = placeholders.map((p) => p.id);

			// 3. Delete the tree itself — this cascades TreeMember / AuditLog.
			await tx.tree.delete({ where: { id: treeId } });

			// 4. Clean up the orphaned placeholder profiles.
			//    Break the cross-references first (motherId / fatherId / spouseId
			//    form a web between the placeholders).
			if (deletableProfileIds.length > 0) {
				await tx.profile.updateMany({
					where: { id: { in: deletableProfileIds } },
					data: { motherId: null, fatherId: null, spouseId: null },
				});
				await tx.profile.deleteMany({
					where: { id: { in: deletableProfileIds } },
				});
			}
			return {
				message: 'Tree deleted.',
				treeId,
				deletedProfileCount: deletableProfileIds.length,
			};
		});

		// The tree's own audit log is gone with it, so leave a trace here, and
		// tell the owner when it wasn't them.
		const byOwner = tree.ownerId === requesterProfileId;
		this.logger.log(
			// JSON.stringify: a name with line breaks can't forge extra log lines.
			`Tree ${treeId} ${JSON.stringify(tree.name)} deleted by ${byOwner ? `profile ${requesterProfileId} (owner)` : 'a site admin'}`
			+ `; ${result.deletedProfileCount} made-up profiles removed`,
		);
		if (!byOwner) {
			const owner = await this.prisma.user.findUnique({
				where: { profileId: tree.ownerId },
				select: { email: true, username: true },
			});
			if (owner?.email) {
				void this.mail.sendQuietly({
					to: owner.email,
					subject: `Your family tree "${tree.name}" was deleted`,
					text: [
						`Hi ${owner.username},`,
						'',
						`Your family tree "${tree.name}" on My Simple Family Tree was deleted by a site administrator.`,
						`When: ${malaysiaTime()}`,
						'',
						'If you think this is a mistake, contact the site administrator through the feedback page.',
					].join('\n'),
				}, 'Tree deletion');
			}
		}
		return result;
	}

	// Powers a "pending claims" notification panel for admins/Members.
	async getPendingClaims(treeId: number, requesterProfileId: number) {
		await this.assertMemberOrAdmin(treeId, requesterProfileId);

		const result = await this.prisma.treeMember.findMany({
			where: { treeId, role: 'HOLDER', claim: 'PENDING' },
			include: {
				profile: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						photoUrl: true,
					}
				}, // the placeholder being claimed, e.g. "John Chan"
				link: {
					include: {
						profile: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								photoUrl: true,
							}
						}
					}
				}, // the real claimant, e.g. "John"
			},
		});
		return result;
	}
}
