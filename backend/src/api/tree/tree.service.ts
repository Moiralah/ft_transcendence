import { Injectable, NotFoundException, ForbiddenException,
	BadRequestException,} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ASSIGNABLE_ROLES = ['ADMIN', 'MODERATOR', 'MEMBER', 'JOINER'] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

@Injectable()
export class TreeService {
  constructor(private readonly prisma: PrismaService) {}

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

  private generateTreeCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // userId (User.id) is passed in separately wherever AuditLog needs it,
  // since AuditLog.userId and AuditLog.profileId are two distinct
  // required fields.

  async createTree(profileId: number, userId: string, name: string, description?: string) {
    let code = this.generateTreeCode();
    let exists = await this.prisma.tree.findUnique({ where: { code } });
    while (exists) {
      code = this.generateTreeCode();
      exists = await this.prisma.tree.findUnique({ where: { code } });
    }

    // Tree.rootId -> TreeMember.id and TreeMember.treeId -> Tree.id form a
    // cycle, so we can't nest-create both sides in a single Tree.create().
    // Do it in three steps instead: blank profile -> root TreeMember
    // (treeId still null) -> Tree (referencing rootId) -> patch treeId back
    // onto the root row.
    return this.prisma.$transaction(async (tx) => {
      const rootProfile = await tx.profile.create({
        data: { firstName: 'Unknown' }, // placeholder — owner can rename later
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
          userId,
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

  async joinTree(profileId: number, userId: string, name: string, code: string) {
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
        userId,
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
  async getUserTrees(profileId: string) {
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
        profile: {
          select: {
			id: true,
			firstName: true,
			lastName: true,
			photoUrl: true,
			gender: true,
			birthDate: true,
			deathDate: true,
          },
        },
      },
	  orderBy: { joinedAt: 'asc'},
    });

	return memberships.map((m) => ({
		id: m.id,
		profileId: m.profileId,
		treeId: m.treeId,
		role: m.role,
		joinedAt: m.joinedAt,
		firstName: m.profile?.firstName ?? '',
		lastName: m.profile?.lastName ?? '',
		photoUrl: m.profile?.photoUrl ?? null,
		gender: m.profile?.gender ?? null,
		birthDate: m.profile?.birthDate ?? null,
		deathDate: m.profile?.deathDate ?? null,
      }));
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

    return this.prisma.treeMember.update({
      where: { profileId_treeId: { profileId: targetProfileId, treeId } },
      data: { role: newRole as AssignableRole },
    });
  }

  async leaveTree(profileId: number, treeId: number) {
    const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });
    if (!tree) {
      throw new NotFoundException('Tree not found.');
    }
    // Bug fix: was comparing tree.ownerId (a Profile id) against userId.
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

      return { message: 'Successfully left the tree.' };
    });
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
    if (target.claim === 'PENDING' || target.claim === 'ACCEPTED') {
      throw new ForbiddenException('Reject or unlink the claim on this profile before deleting it.');
    }

    const childCount = await this.prisma.profile.count({
      where: { OR: [{ motherId: target.profileId! }, { fatherId: target.profileId! }] },
    });
    if (childCount > 0) {
      throw new ForbiddenException('This profile still has children linked to it — reassign them first.');
    }

    await this.prisma.treeMember.delete({ where: { id: targetMemberId } });
    await this.prisma.profile.delete({ where: { id: target.profileId! } });

    return { message: 'Profile node deleted.' };
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

    return this.prisma.treeMember.update({
      where: { id: holderMemberId },
      data: { linkId: requesterMember.id, claim: 'PENDING' },
      include: { profile: true, link: { include: { profile: true } } },
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
      await tx.treeMember.update({
        where: { id: holder.linkId! },
        data: { role: 'MEMBER' },
      });

      return tx.treeMember.update({
        where: { id: holderMemberId },
        data: { claim: 'ACCEPTED' },
        include: { profile: true, link: { include: { profile: true } } },
      });
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
    return this.prisma.treeMember.update({
      where: { id: holderMemberId },
      data: { linkId: null, claim: 'REJECTED' },
    });
  }

  private async assertModeratorOrAdmin(treeId: number, profileId: number) {
    const membership = await this.prisma.treeMember.findUnique({
      where: { profileId_treeId: { profileId, treeId } },
    });
    if (!membership || !['ADMIN', 'MODERATOR'].includes(membership.role)) {
      throw new ForbiddenException('Only admins or moderators can do this.');
    }
  }
}
