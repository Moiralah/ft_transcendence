import {
  ConflictException, ForbiddenException, Injectable, NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FriendService {
  constructor(private readonly prisma: PrismaService) {}

  async sendRequest(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) {
      throw new ConflictException('You cannot add yourself as a friend');
    }

    const addressee = await this.prisma.user.findUnique({
      where: { id: addresseeId },
      select: {
        id: true,
        username: true
      },
    });

    if (!addressee) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          {
            requesterId,
            addresseeId
          },
          {
            requesterId: addresseeId,
            addresseeId: requesterId
          },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new ConflictException('You are already friends');
      }

      if (
        existing.status === 'PENDING' &&
        existing.requesterId === requesterId
      ) {
        throw new ConflictException('Friend request already sent');
      }

      if (
        existing.status === 'PENDING' &&
        existing.requesterId === addresseeId
      ) {
        throw new ConflictException(
          'This user has already sent you a friend request',
        );
      }

      throw new ConflictException('A previous friend relationship exists');
    }

    return this.prisma.friendship.create({
      data: {
        requesterId,
        addresseeId,
        status: 'PENDING'
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        addressee: {
          select: {
            id: true,
            username: true
          },
        },
      },
    });
  }

  async acceptRequest(userId: string, friendId: number) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: friendId },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.addresseeId !== userId) {
      throw new ForbiddenException(
        'Only the recipient can accept this request',
      );
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException('Friend request is no longer pending');
    }

    return this.prisma.friendship.update({
      where: { id: friendId },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date()
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        respondedAt: true,
        requester: {
          select: {
            id: true,
            username: true
          },
        },
      },
    });
  }

  async rejectRequest(userId: string, friendId: number) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: friendId },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.addresseeId !== userId) {
      throw new ForbiddenException(
        'Only the recipient can reject this request',
      );
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException('Friend request is no longer pending');
    }

    return this.prisma.friendship.update({
      where: { id: friendId },
      data: {
        status: 'DECLINED',
        respondedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        respondedAt: true,
        requester: {
          select: {
            id: true,
            username: true
          },
        },
      },
    });
  }

  async cancelRequest(userId: string, friendId: number) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: friendId }
    });
  
    if (!request) {
      throw new NotFoundException('Friend request not found');
    }
  
    if (request.requesterId !== userId) {
      throw new ForbiddenException('Only the requester can cancel this request');
    }
  
    if (request.status !== 'PENDING') {
      throw new ConflictException('Friend request is no longer pending');
    }
  
    return this.prisma.friendship.delete({
      where: { id: friendId }
    });
  }
  
  async unfriend(userId: string, friendId: number) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendId },
    });
  
    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }
  
    const isParticipant = friendship.requesterId === userId ||
      friendship.addresseeId === userId;
  
    if (!isParticipant) {
      throw new ForbiddenException('You are not part of this friendship');
    }
  
    if (friendship.status !== 'ACCEPTED') {
      throw new ConflictException('You are not currently friends');
    }
  
    return this.prisma.friendship.delete({
      where: { id: friendId }
    });
  }

  async getStatuses(userId: string, targetUserIds: string[]) {
    const ids = [...new Set(targetUserIds)].filter((id) => id !== userId);

    if (ids.length === 0) {
      return [];
    }

    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          {
            requesterId: userId,
            addresseeId: { in: ids }
          },
          {
            requesterId: { in: ids },
            addresseeId: userId
          },
        ],
      },
      select: {
        id: true,
        requesterId: true,
        addresseeId: true,
        status: true
      },
    });

    return ids.map((targetUserId) => {
      const friendship = friendships.find(
        (friend) =>
          (friend.requesterId === userId && friend.addresseeId === targetUserId) ||
          (friend.requesterId === targetUserId && friend.addresseeId === userId)
      );

      if (!friendship) {
        return {
          userId: targetUserId,
          status: 'NONE',
          friendId: null
        };
      }

      if (friendship.status === 'PENDING') {
        return {
          userId: targetUserId,
          status:
            friendship.requesterId === userId
              ? 'PENDING_OUT'
              : 'PENDING_IN',
          friendId: friendship.id
        };
      }

      return {
        userId: targetUserId,
        status: friendship.status,
        friendId: friendship.id
      };
    });
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId },
          { addresseeId: userId }
        ],
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            username: true
          },
        },
        addressee: {
          select: {
            id: true,
            username: true
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return friendships.map((friendship) => ({
      id: friendship.id,
      status: friendship.status,
      createdAt: friendship.createdAt,
      user:
        friendship.requester.id === userId
          ? friendship.addressee
          : friendship.requester,
    }));
  }

  async getInRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getOutRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        requesterId: userId,
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        addressee: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}