import {
	BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService, malaysiaTime } from '../../mail/mail.service';

// Site admin accounts (Admin table). They are separate from users: an admin is
// a Supabase login of its own, made here, never a user whose role changed. A
// member's email can't become an admin (Supabase emails are unique), so a
// person who is both uses two emails.
@Injectable()
export class AdminsService {
	private readonly logger = new Logger(AdminsService.name);
	private readonly supabase: SupabaseClient;

	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
		private readonly mail: MailService,
	) {
		this.supabase = createClient(
			this.config.get<string>('SUPABASE_AUTH_URL')!,
			this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
		);
	}

	findAll() {
		return this.prisma.admin.findMany({
			select: { id: true, username: true, email: true, twoFactorEnabled: true, createdAt: true },
			orderBy: { createdAt: 'asc' },
		});
	}

	// Makes the Supabase login (email already confirmed) and the Admin row. The
	// new admin signs in on the staff page with this password, is sent to set
	// up MFA first, and can change the password in Settings.
	async create(rawEmail: string, password: string, requesterId: string) {
		const email = rawEmail.trim().toLowerCase();
		if (await this.prisma.user.findUnique({ where: { email } })) {
			throw new ConflictException('This email belongs to a member account. Admin accounts are separate: use another email.');
		}

		const { data, error } = await this.supabase.auth.admin.createUser({ email, password, email_confirm: true });
		if (error || !data.user) {
			if (error?.status === 422 || /already/i.test(error?.message ?? '')) {
				throw new ConflictException('This email already has a login. Admin accounts need an email of their own.');
			}
			if (error?.status === 400) throw new BadRequestException(error.message);
			throw new ServiceUnavailableException('Could not create the login right now. Please try again.');
		}

		let admin;
		try {
			admin = await this.prisma.admin.create({
				data: { id: data.user.id, email, username: await this.freeUsername(email) },
				select: { id: true, username: true, email: true, twoFactorEnabled: true, createdAt: true },
			});
		} catch (e) {
			// Don't leave a login behind that signs in to nothing.
			await this.supabase.auth.admin.deleteUser(data.user.id);
			throw e;
		}
		this.logger.log(`Admin ${admin.id} added by admin ${requesterId}`);

		void this.mail.sendQuietly({
			to: email,
			subject: 'You are now a site admin on My Simple Family Tree',
			text: [
				'Hi,',
				'',
				'An administrator made you a site admin account on My Simple Family Tree.',
				'Sign in through "Sign in as staff" with this email and the password they gave you. You will set up an authenticator app (MFA) first; then change the password in Settings.',
				`When: ${malaysiaTime()}`,
				'',
				this.staffLink(),
			].join('\n'),
		}, 'Admin added');
		return admin;
	}

	// Removes the Admin row (recovery codes cascade) and its Supabase login. An
	// admin can't remove themselves, and the last admin can't go: a site with
	// no admin left has nobody to manage it.
	async remove(id: string, requesterId: string) {
		if (id === requesterId) {
			throw new ForbiddenException('You cannot remove your own admin account.');
		}
		const admin = await this.prisma.admin.findUnique({ where: { id } });
		if (!admin) {
			throw new NotFoundException('Admin not found.');
		}
		if (await this.prisma.admin.count() <= 1) {
			throw new ForbiddenException('The last admin account cannot be removed.');
		}

		await this.prisma.admin.delete({ where: { id } });
		this.logger.log(`Admin ${id} removed by admin ${requesterId}`);

		void this.mail.sendQuietly({
			to: admin.email,
			subject: 'Your My Simple Family Tree admin account has been removed',
			text: [
				`Hi ${admin.username},`,
				'',
				'Your site admin account on My Simple Family Tree has been removed by another administrator. You can no longer sign in as staff.',
				`When: ${malaysiaTime()}`,
			].join('\n'),
		}, 'Admin removed');

		// After the row, like UsersService.remove: if this fails the login is
		// left but signs in to nothing (the staff page refuses it).
		const { error } = await this.supabase.auth.admin.deleteUser(id);
		if (error) {
			this.logger.warn(`Admin ${id} removed but its Supabase login was not: ${error.message}`);
			return { message: 'Admin removed, but their login could not be deleted.' };
		}
		return { message: 'Admin removed.' };
	}

	// Same rule as user signups: the part before the @, with a short suffix on a clash.
	private async freeUsername(email: string) {
		const base = email.split('@')[0] || 'admin';
		for (let attempt = 0; attempt < 5; attempt++) {
			const username = attempt === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`;
			if (!(await this.prisma.admin.findUnique({ where: { username } }))) return username;
		}
		return `${base}-${randomBytes(4).toString('hex')}`;
	}

	private staffLink(): string {
		const site = (this.config.get<string>('CORS_ORIGIN') || '').split(',')[0].trim();
		return site ? `${site}/staff` : '';
	}
}
