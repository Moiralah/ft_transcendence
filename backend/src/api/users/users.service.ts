import {
	Injectable, Logger, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService, malaysiaTime } from '../../mail/mail.service';

const ROLE_NAMES: Record<string, string> = { ADMIN: 'Admin', MODERATOR: 'Moderator', USER: 'User' };
const ROLE_RIGHTS: Record<string, string> = {
	ADMIN: 'You can now open the Admin Panel from your dashboard: see all users, change their roles, suspend and delete accounts.',
	MODERATOR: 'You can now open Moderation from your dashboard: see all users and suspend or reactivate accounts.',
	USER: 'You no longer have access to the Admin Panel or Moderation.',
};

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);
	// Service-role client, same credentials AuthService uses to verify tokens.
	// Null (not a throw) when unset so the app still boots without Supabase.
	private readonly supabase: SupabaseClient | null;

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
		private readonly mail: MailService,
	) {
		const url = config.get<string>('SUPABASE_AUTH_URL');
		const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
		this.supabase = url && key ? createClient(url, key) : null;
	}

	findAll() {
		return this.prisma.user.findMany({
			select: {
				id: true,
				username: true,
				email: true,
				role: true,
				suspended: true,
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

		const updated = await this.prisma.user.update({
			where: { id },
			data: { role },
			select: { id: true, username: true, email: true, role: true },
		});
		if (user.role !== role && updated.email) {
			// Don't wait for Gmail: the change is saved whatever happens to the email.
			void this.mail.sendQuietly({
				to: updated.email,
				subject: `Your role on My Simple Family Tree is now ${ROLE_NAMES[role]}`,
				text: [
					`Hi ${updated.username},`,
					'',
					`An administrator changed your role on My Simple Family Tree from ${ROLE_NAMES[user.role] ?? user.role} to ${ROLE_NAMES[role]}.`,
					ROLE_RIGHTS[role],
					`When: ${malaysiaTime()}`,
					'',
					'Log out and log in again for the change to show.',
					'',
					this.siteLink(),
				].join('\n'),
			}, 'Role change');
		}
		return updated;
	}

	private siteLink(): string {
		const site = (this.config.get<string>('CORS_ORIGIN') || '').split(',')[0].trim();
		return site ? `${site}/login` : '';
	}

	async setSuspended(id: string, suspended: boolean, requesterId: string, requesterRole: string) {
		if (id === requesterId) {
			throw new ForbiddenException('You cannot suspend your own account.');
		}

		const user = await this.prisma.user.findUnique({ where: { id } });
		if (!user) {
			throw new NotFoundException('User not found.');
		}
		if (user.role === 'ADMIN' && requesterRole !== 'ADMIN') {
			throw new ForbiddenException('Moderators cannot suspend an admin.');
		}

		const updated = await this.prisma.user.update({
			where: { id },
			data: { suspended },
			select: { id: true, username: true, email: true, suspended: true },
		});
		if (user.suspended !== suspended && updated.email) {
			void this.mail.sendQuietly({
				to: updated.email,
				subject: suspended
					? 'Your My Simple Family Tree account has been suspended'
					: 'Your My Simple Family Tree account is active again',
				text: (suspended
					? [
						`Hi ${updated.username},`,
						'',
						'Your account on My Simple Family Tree has been suspended by a moderator or administrator.',
						'You are logged out and can\'t log in until it is reactivated.',
						`When: ${malaysiaTime()}`,
						'',
						'If you think this is a mistake, reply through the feedback form on the site.',
					]
					: [
						`Hi ${updated.username},`,
						'',
						'Your account on My Simple Family Tree has been reactivated. You can log in again.',
						`When: ${malaysiaTime()}`,
						'',
						this.siteLink(),
					]).join('\n'),
			}, suspended ? 'Suspension' : 'Reactivation');
		}
		return updated;
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
			// The profile is family-tree data (it can be a tree's root or have
			// relatives linked to it), so it's kept as an unclaimed placeholder
			// rather than deleted. Only its userId is cleared: profiles.userId is
			// unique, so leaving it set makes the next login for this account fail
			// creating a fresh profile (500). One transaction so a failed user
			// delete (e.g. invitations still reference them) undoes the detach.
			await this.prisma.$transaction([
				this.prisma.profile.updateMany({ where: { userId: id }, data: { userId: null } }),
				this.prisma.user.delete({ where: { id } }),
			]);
		} catch {
			// Foreign-key violation — user still has invitations/audit logs.
			throw new ConflictException(
				'This user has related data (audit logs or invitations) and cannot be deleted.',
			);
		}

		// Also remove the Supabase login. Without this the person can still sign
		// in (email or OAuth) and the backend silently creates a brand-new user.
		// Done after the DB delete so a Supabase hiccup can't leave a user row
		// with no way to log in; if it fails the admin is told.
		if (this.supabase) {
			const { error } = await this.supabase.auth.admin.deleteUser(id);
			if (error) {
				this.logger.warn(`Deleted user ${id} locally but Supabase account removal failed: ${error.message}`);
				return { message: 'User deleted, but their Supabase login could not be removed.' };
			}
		} else {
			this.logger.warn(`Supabase not configured; login for deleted user ${id} was not removed.`);
		}

		return { message: 'User deleted.' };
	}
}
