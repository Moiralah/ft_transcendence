import {
	Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) { }

	findAll() {
		return this.prisma.user.findMany({
			select: {
				id: true,
				username: true,
				email: true,
				role: true,
				twoFactorEnabled: true,
				createdAt: true,
				profile: { select: { firstName: true, lastName: true } },
			},
			orderBy: { createdAt: 'asc' },
		});
	}

	async updateRole(id: string, role: 'ADMIN' | 'MODERATOR' | 'USER', requesterId: string) {
		if (id === requesterId) {
			throw new ForbiddenException('You cannot change your own role.');
		}

		const user = await this.prisma.user.findUnique({ where: { id } });
		if (!user) {
			throw new NotFoundException('User not found.');
		}

		return this.prisma.user.update({
			where: { id },
			data: { role },
			select: { id: true, username: true, email: true, role: true },
		});
	}

	async remove(id: string, requesterId: string) {
		if (id === requesterId) {
			throw new ForbiddenException('You cannot delete your own account.');
		}

		const user = await this.prisma.user.findUnique({ where: { id } });
		if (!user) {
			throw new NotFoundException('User not found.');
		}

		try {
			await this.prisma.user.delete({ where: { id } });
			return { message: 'User deleted.' };
		} catch {
			// Foreign-key violation — user still owns profiles/audit logs/invitations.
			throw new ConflictException(
				'This user has related data (profile, audit logs, or invitations) and cannot be deleted.',
			);
		}
	}
}
