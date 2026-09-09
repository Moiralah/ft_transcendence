import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TreeService {
  constructor(private readonly prisma: PrismaService) {}

  // Generate a unique 6-character code
  private generateTreeCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Helper: every TreeMember row keys off Profile.id (Int), not User.id (String).
  // Resolve a user's profileId once and reuse it everywhere below.
  private async getProfileIdForUser(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileId: true },
    });

    if (!user?.profileId) {
      throw new ForbiddenException('This user has no associated profile.');
    }

    return user.profileId;
  }

  async createTree(userId: string, name: string, description?: string) {
    const profileId = await this.getProfileIdForUser(userId);

    let code = this.generateTreeCode();
    // Ensure uniqueness
    let exists = await this.prisma.tree.findUnique({ where: { code } });
    while (exists) {
      code = this.generateTreeCode();
      exists = await this.prisma.tree.findUnique({ where: { code } });
    }

    const tree = await this.prisma.tree.create({
      data: {
        name,
        code,
        description,
        ownerId: userId,
        members: {
          create: {
            profileId,
            role: 'ADMIN',
          },
        },
      },
      include: {
        members: {
          include: { profile: true },
        },
        owner: true,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        treeId: tree.id,
        userId,
        action: 'CREATE_TREE',
        details: `Created tree "${name}" with code ${code}`,
      },
    });

    return tree;
  }

  async joinTree(userId: string, name: string, code: string) {
    const profileId = await this.getProfileIdForUser(userId);

    const tree = await this.prisma.tree.findFirst({
      where: {
        name,
        code,
      },
    });

    if (!tree) {
      throw new NotFoundException('Tree not found. Check name and code.');
    }

    // Check if already a member
    const existing = await this.prisma.treeMember.findUnique({
      where: {
        profileId_treeId: {
          profileId,
          treeId: tree.id,
        },
      },
    });

    if (existing) {
      throw new ForbiddenException('You are already a member of this tree.');
    }

    // Add as member (default role: MEMBER)
    const member = await this.prisma.treeMember.create({
      data: {
        profileId,
        treeId: tree.id,
        role: 'MEMBER',
      },
      include: {
        profile: true,
        tree: true,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        treeId: tree.id,
        userId,
        action: 'JOIN_TREE',
        details: `User joined tree "${tree.name}" as MEMBER`,
      },
    });

    return member;
  }

  async searchTree(query: string) {
    return this.prisma.tree.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
        ],
        isPublic: true,
      },
      include: {
        owner: true,
        members: {
          take: 5, // preview
          include: { profile: true },
        },
      },
    });
  }

  async getUserTrees(userId: string) {
    const profileId = await this.getProfileIdForUser(userId);

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

    return memberships.map((m) => ({
      ...m.tree,
      profileRole: m.role,
    }));
  }

  async getTreeById(treeId: number, userId: string) {
    const profileId = await this.getProfileIdForUser(userId);

    const member = await this.prisma.treeMember.findUnique({
      where: {
        profileId_treeId: {
          profileId,
          treeId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this tree.');
    }

    const tree = await this.prisma.tree.findUnique({
      where: { id: treeId },
      include: {
        owner: true,
        members: {
          include: { profile: true },
        },
      },
    });

    if (!tree) {
      throw new NotFoundException('Tree not found.');
    }

    return {
      ...tree,
      userRole: member.role,
    };
  }

  async updateMemberRole(
    treeId: number,
    userId: string,
    targetUserId: string,
    newRole: string,
  ) {
    const [currentProfileId, targetProfileId] = await Promise.all([
      this.getProfileIdForUser(userId),
      this.getProfileIdForUser(targetUserId),
    ]);

    // Check if current user is ADMIN
    const currentMember = await this.prisma.treeMember.findUnique({
      where: {
        profileId_treeId: {
          profileId: currentProfileId,
          treeId,
        },
      },
    });

    if (!currentMember || currentMember.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can change roles.');
    }

    // Cannot change own role
    if (userId === targetUserId) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    // Cannot change owner's role
    const tree = await this.prisma.tree.findUnique({
      where: { id: treeId },
    });

    if (!tree) {
      throw new NotFoundException('Tree not found.');
    }

    if (tree.ownerId === targetUserId) {
      throw new ForbiddenException("Cannot change the owner's role.");
    }

    const updated = await this.prisma.treeMember.update({
      where: {
        profileId_treeId: {
          profileId: targetProfileId,
          treeId,
        },
      },
      data: { role: newRole as any },
    });

    return updated;
  }

  async leaveTree(userId: string, treeId: number) {
    const tree = await this.prisma.tree.findUnique({
      where: { id: treeId },
    });

    if (!tree) {
      throw new NotFoundException('Tree not found.');
    }

    if (tree.ownerId === userId) {
      throw new ForbiddenException('Owner cannot leave their own tree. Transfer ownership first.');
    }

    const profileId = await this.getProfileIdForUser(userId);

    await this.prisma.treeMember.delete({
      where: {
        profileId_treeId: {
          profileId,
          treeId,
        },
      },
    });

    return { message: 'Successfully left the tree.' };
  }
}