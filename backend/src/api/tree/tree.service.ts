import {
	Injectable, NotFoundException, ForbiddenException,
	BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ASSIGNABLE_ROLES = ['ADMIN', 'MODERATOR', 'MEMBER', 'JOINER'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

@Injectable()
export class TreeService {
	constructor(private readonly prisma: PrismaService) { }

	// TREE CREATION
	// What will happen?
	// need to set Tree name, tree code, owner, create root node
	// each node have a made-up profile(role HOLDER) attached with tree member table all made-up node stay in the tree page only
	// every profile with user that join the tree will have their own tree member table
	// when they claim one node. their profile will be linked via Tree member table
	// the frontend node will show their user.profile data instead of made-up.profile
	// Onwer can delete tree or transfer ownership to admin
	// Admin can do anything, change root profile
	// Moderator can approved claim profile add new made-up profile delete profile
	// Joiner can claim node and view only - once node is claim he become Member
	// Member can make and update made-up profile for their own father-mother-children only
	// Hanging node profile that is not attached link to anyone in the tree will not be shown in the tree map
	// Anyone who leave the tree will unlink their profile from Tree Member. made-up profile will re-surface on that node
	// Tree starting point will be root profile

	// AuditLog.profileId is enough on its own — User.profileId is one-to-one,
	// so it always resolves back to the acting user without a separate
	// userId column.

	private generateTreeCode(): string {
		return Math.random().toString(36).substring(2, 8).toUpperCase();
	}

	async createTree(profileId: number, name: string, description?: string) {
		let code: string;
		do {
			code = this.generateTreeCode();
		} while (await this.prisma.tree.findUnique({ where: { code } }));

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

			await tx.auditLog.create({
				data: {
					treeId: tree.id,
					profileId,
					action: 'CREATE_TREE',
					details: `Created tree "${name}" with code ${code}`,
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
		const tree = await this.prisma.tree.findFirst({ where: { name, code } });
		if (!tree) {
			throw new NotFoundException('Tree not found. Check name and code.');
		}

		const existing = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId, treeId: tree.id } },
		});
		if (existing) {
			throw new ForbiddenException('You are already a member of this tree.');
		}

		const member = await this.prisma.treeMember.create({
			data: { profileId, treeId: tree.id, role: 'JOINER' },
			include: { profile: true, tree: true },
		});

		await this.prisma.auditLog.create({
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
			select: {
				id: true,
				name: true,
				description: true,
				isPublic: true,
				createdAt: true,
				owner: true,
				members: {
					take: 5,
					include: { profile: true },
				},
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
						owner: true,
						members: {
							take: 10,
							include: { profile: true },
						},
					},
				},
			},
		});

		return memberships
			.filter((m) => m.tree)
			.map((m) => ({
				...m.tree,
				profileRole: m.role,
			}));
	}

	async getTreeMember(treeId: number) {
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
		return { ...tree, userRole: member.role };
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

		await this.prisma.auditLog.create({
			data: {
				treeId,
				profileId: requesterProfileId,
				action: 'UPDATE_TREE',
				details: `Updated tree "${updatedTree.name}"`,
			},
		});

		return updatedTree;
	}

	// Add a made-up (placeholder) profile node.
	// ADMIN/MODERATOR can attach it anywhere in the tree.
	// A plain MEMBER can only attach it as their own mother, father, or child.
	async addProfileNode(
		treeId: number,
		requesterProfileId: number,
		profileData: {
			firstName: string;
			lastName?: string;
			gender?: string;
			birthDate?: Date;
			motherId?: number;
			fatherId?: number;
		},
		relationToRequester?: 'CHILD' | 'MOTHER' | 'FATHER',
	) {
		const requesterMembership = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId: requesterProfileId, treeId } },
		});

		if (
			!requesterMembership ||
			!['ADMIN', 'MODERATOR', 'MEMBER'].includes(requesterMembership.role)
		) {
			throw new ForbiddenException('You do not have permission to add profiles to this tree.');
		}

		const isPrivileged = ['ADMIN', 'MODERATOR'].includes(requesterMembership.role);

		return this.prisma.$transaction(async (tx) => {
			let data = { ...profileData };

			if (!isPrivileged) {
				if (relationToRequester === 'CHILD') {
					if (data.motherId !== requesterProfileId && data.fatherId !== requesterProfileId) {
						throw new ForbiddenException('As a member, you can only add your own children this way.');
					}
				} else if (relationToRequester === 'MOTHER' || relationToRequester === 'FATHER') {
					// Adding your own parent — ignore any motherId/fatherId the
					// caller tried to sneak onto the new node itself.
					data = { ...data, motherId: undefined, fatherId: undefined };
				} else {
					throw new ForbiddenException(
						'Specify how this profile relates to you: CHILD, MOTHER, or FATHER.',
					);
				}
			}

			const profile = await tx.profile.create({ data });

			if (!isPrivileged && (relationToRequester === 'MOTHER' || relationToRequester === 'FATHER')) {
				await tx.profile.update({
					where: { id: requesterProfileId },
					data:
						relationToRequester === 'MOTHER'
							? { motherId: profile.id }
							: { fatherId: profile.id },
				});
			}

			return tx.treeMember.create({
				data: { profileId: profile.id, treeId, role: 'HOLDER' },
				include: { profile: true },
			});
		});
	}

	private readonly memberProfileSelect = {
		id: true,
		firstName: true,
		lastName: true,
		photoUrl: true,
		gender: true,
		birthDate: true,
		deathDate: true,
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
			deathDate: display?.deathDate ?? null,
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
			!['ADMIN', 'MODERATOR', 'MEMBER'].includes(requesterMembership.role)
		) {
			throw new ForbiddenException('You do not have permission to add children in this tree.');
		}

		const isPrivileged = ['ADMIN', 'MODERATOR'].includes(requesterMembership.role);

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

			await tx.auditLog.create({
				data: {
					treeId,
					profileId: requesterProfileId,
					action: 'ADD_CHILD',
					details: `Added a child under profile ${parentProfileId}`,
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
			!['ADMIN', 'MODERATOR', 'MEMBER'].includes(requesterMembership.role)
		) {
			throw new ForbiddenException('You do not have permission to add spouse in this tree.');
		}

		const isPrivileged = ['ADMIN', 'MODERATOR'].includes(requesterMembership.role);

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

			await tx.auditLog.create({
				data: {
					treeId,
					profileId: requesterProfileId,
					action: 'ADD_SPOUSE',
					details: `Added a spouse for profile ${partnerProfileId}`,
				},
			});

			return rows.map((r) => this.mapMemberRow(r));
		});
	}

	// Role management — profileId/targetProfileId are already what the
	// frontend has on hand from the tree's member list, no extra lookups.
	async updateMemberRole(
		treeId: number,
		profileId: number,
		targetProfileId: number,
		newRole: string,
	) {
		if (profileId === targetProfileId) {
			throw new ForbiddenException('You cannot change your own role.');
		}

		if (!ASSIGNABLE_ROLES.includes(newRole as AssignableRole)) {
			throw new BadRequestException(`Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`);
		}

		const currentMember = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId, treeId } },
		});

		// Bug fix: `role !== 'ADMIN' || role !== 'MODERATOR'` is always true for
		// any single role value (it can't equal both at once), so the old check
		// let anyone through. This is what it should have been.
		if (!currentMember || !['ADMIN', 'MODERATOR'].includes(currentMember.role)) {
			throw new ForbiddenException('Only admins or moderators can change roles.');
		}

		// A MODERATOR shouldn't be able to hand out ADMIN (their own ceiling or
		// above) — only an existing ADMIN can do that.
		if (newRole === 'ADMIN' && currentMember.role !== 'ADMIN') {
			throw new ForbiddenException('Only an admin can grant admin.');
		}

		const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });
		if (!tree) {
			throw new NotFoundException('Tree not found.');
		}

		// Bug fix: was comparing against an undefined `targetUserId`.
		if (tree.ownerId === targetProfileId) {
			throw new ForbiddenException("Cannot change the owner's role.");
		}

		return this.prisma.$transaction(async (tx) => {
			const updated = await tx.treeMember.update({
				where: { profileId_treeId: { profileId: targetProfileId, treeId } },
				data: { role: newRole as AssignableRole },
			});

			await tx.auditLog.create({
				data: {
					treeId,
					profileId,
					action: 'UPDATE_ROLE',
					details: `Changed role of profile ${targetProfileId} to ${newRole}`,
				},
			});

			return updated;
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

	private async assertModeratorOrAdmin(treeId: number, profileId: number) {
		const membership = await this.prisma.treeMember.findUnique({
			where: { profileId_treeId: { profileId, treeId } },
		});
		if (!membership || !['ADMIN', 'MODERATOR'].includes(membership.role)) {
			throw new ForbiddenException('Only admins or moderators can do this.');
		}
	}

	// Moderator/Admin only — remove a placeholder node that isn't claimed,
	// isn't the tree's root, and isn't load-bearing for anyone else's edges.
	async deleteProfileNode(treeId: number, requesterProfileId: number, targetMemberId: number) {
		await this.assertModeratorOrAdmin(treeId, requesterProfileId);

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
			if (target.linkId) {
				const linkedMember = await tx.treeMember.findUnique({ where: { id: target.linkId } });
				if (linkedMember && linkedMember.role === 'MEMBER') {
					await tx.treeMember.update({
						where: { id: linkedMember.id },
						data: { role: 'JOINER' },
					});
				}
				// Clear the link on the placeholder before deleting the row
				await tx.treeMember.update({
					where: { id: targetMemberId },
					data: { linkId: null, claim: 'EMPTY' },
				});
			}
			await tx.treeMember.delete({ where: { id: targetMemberId } });
			await tx.profile.delete({ where: { id: target.profileId! } });

			await tx.auditLog.create({
				data: {
					treeId,
					profileId: requesterProfileId,
					action: 'DELETE_PROFILE',
					details: `Deleted profile ${target.profileId}`,
				},
			});

			return { message: 'Profile node deleted.' };
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

		const holder = await this.prisma.treeMember.findUnique({ where: { id: holderMemberId } });
		if (!holder || holder.treeId !== treeId || holder.role !== 'HOLDER') {
			throw new NotFoundException('Placeholder profile not found in this tree.');
		}
		if (holder.claim === 'PENDING' || holder.claim === 'ACCEPTED') {
			throw new ForbiddenException('This profile already has a pending or accepted claim.');
		}

		return this.prisma.$transaction(async (tx) => {
			const updated = await tx.treeMember.update({
				where: { id: holderMemberId },
				data: { linkId: requesterMember.id, claim: 'PENDING' },
				include: { profile: true, link: { include: { profile: true } } },
			});

			await tx.auditLog.create({
				data: {
					treeId,
					profileId: requesterProfileId,
					action: 'REQUEST_CLAIM',
					details: `Requested to claim profile ${holder.profileId}`,
				},
			});

			return updated;
		});
	}

	async approveClaim(treeId: number, approverProfileId: number, holderMemberId: number) {
		await this.assertModeratorOrAdmin(treeId, approverProfileId);

		const holder = await this.prisma.treeMember.findUnique({ where: { id: holderMemberId } });
		if (!holder || holder.treeId !== treeId) {
			throw new NotFoundException('Placeholder profile not found in this tree.');
		}
		if (holder.claim !== 'PENDING' || !holder.linkId) {
			throw new ForbiddenException('There is no pending claim on this profile.');
		}

		return this.prisma.$transaction(async (tx) => {
			const linkedMember = await tx.treeMember.findUnique({ where: { id: holder.linkId! } });
			if (!linkedMember) {
				throw new NotFoundException('Linked member not found.');
			}

			// Only promote JOINER -> MEMBER.
			// ADMIN / MODERATOR keep their role.
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

			await tx.auditLog.create({
				data: {
					treeId,
					profileId: approverProfileId,
					action: 'APPROVE_CLAIM',
					details: `Approved claim on profile ${holder.profileId}`,
				},
			});

			return updated;
		});
	}

	async rejectClaim(treeId: number, approverProfileId: number, holderMemberId: number) {
		await this.assertModeratorOrAdmin(treeId, approverProfileId);

		const holder = await this.prisma.treeMember.findUnique({ where: { id: holderMemberId } });
		if (!holder || holder.treeId !== treeId) {
			throw new NotFoundException('Placeholder profile not found in this tree.');
		}
		if (holder.claim !== 'PENDING') {
			throw new ForbiddenException('There is no pending claim on this profile.');
		}

		// Free the node back up rather than locking it permanently — a fresh
		// request flips it back to PENDING, so this doesn't block a retry
		// (by this or another claimant).
		return this.prisma.$transaction(async (tx) => {
			const updated = await tx.treeMember.update({
				where: { id: holderMemberId },
				data: { linkId: null, claim: 'EMPTY' },
			});

			await tx.auditLog.create({
				data: {
					treeId,
					profileId: approverProfileId,
					action: 'REJECT_CLAIM',
					details: `Rejected claim on profile ${holder.profileId}`,
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
		//    - ADMIN / MODERATOR can unclaim any slot.
		const isClaimant = holder.linkId === requesterMember.id;
		const isModeratorOrAdmin = ['ADMIN', 'MODERATOR'].includes(requesterMember.role);

		if (!isClaimant && !isModeratorOrAdmin) {
			throw new ForbiddenException('You can only unclaim a slot you claimed yourself.');
		}

		return this.prisma.$transaction(async (tx) => {
			// 4. If the claim was accepted, the claimant may have been promoted
			//    from JOINER to MEMBER. Revert that.
			//    ADMIN / MODERATOR keep their role.
			if (isAccepted) {
				const linkedMember = await tx.treeMember.findUnique({
					where: { id: holder.linkId! },
				});
				if (!linkedMember) {
					throw new NotFoundException('Linked member not found.');
				}
				if (linkedMember.role === 'MEMBER') {
					await tx.treeMember.update({
						where: { id: linkedMember.id },
						data: { role: 'JOINER' },
					});
				}
			}

			// 5. Clear the link on the placeholder.
			const updated = await tx.treeMember.update({
				where: { id: holderMemberId },
				data: { linkId: null, claim: 'EMPTY' },
				include: { profile: true, link: { include: { profile: true } } },
			});

			// 6. Audit log.
			await tx.auditLog.create({
				data: {
					treeId,
					profileId: requesterProfileId,
					action: isAccepted ? 'UNCLAIM' : 'REJECT_CLAIM',
					details: isAccepted
						? `Unclaimed profile ${holder.profileId}`
						: `Withdrew pending claim on profile ${holder.profileId}`,
				},
			});

			return updated;
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

			await tx.auditLog.create({
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

	// Powers a "pending claims" notification panel for admins/moderators.
	async getPendingClaims(treeId: number, requesterProfileId: number) {
		await this.assertModeratorOrAdmin(treeId, requesterProfileId);

		return this.prisma.treeMember.findMany({
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
	}

}
