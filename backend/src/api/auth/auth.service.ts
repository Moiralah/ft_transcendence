
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
	private supabase: SupabaseClient;

	constructor(
		private readonly prisma: PrismaService,
		private readonly jwt: JwtService,
		private readonly config: ConfigService,
	) {
		const supabaseUrl = this.config.get<string>('SUPABASE_AUTH_URL');
		const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
		if (!supabaseUrl || !supabaseKey) {
			throw new Error('Supabase credentials missing');
		}
		this.supabase = createClient(supabaseUrl, supabaseKey);
	}

	async loginWithSupabaseToken(accessToken: string) {
		// 1. Verify the token with Supabase
		const { data, error } = await this.supabase.auth.getUser(accessToken);
		if (error || !data.user) {
			throw new UnauthorizedException('Invalid Supabase token');
		}

		const supabaseUser = data.user;

		// 2. Find or create user in local database (using Prisma).
		// Looked up by Supabase's own stable UUID, not email — email can
		// change (e.g. via a "change email" flow), but the UUID never does.
		// Looking up by email would fail to find the existing user after an
		// email change and then crash trying to create a duplicate with the
		// same id (unique constraint violation on the primary key).
		let user = await this.prisma.user.findUnique({
			where: { id: supabaseUser.id },
		});

		if (!user) {
			user = await this.prisma.user.create({
				data: {
					id: supabaseUser.id, // use the Supabase UUID
					email: supabaseUser.email,
					username: supabaseUser.email.split('@')[0], // or use user_metadata.full_name

					profile: {
						create: {
							firstName: '',
							userId: supabaseUser.id,
						}
					}
				},
			});
		} else if (user.email !== supabaseUser.email) {
			// Keep our local copy in sync if it ever drifts — e.g. after a
			// confirmed email change in Supabase.
			user = await this.prisma.user.update({
				where: { id: user.id },
				data: { email: supabaseUser.email },
			});
		}

		if (user.suspended) {
			throw new ForbiddenException('Your account has been suspended.');
		}

		// 3. If this user has 2FA enabled, don't issue the real JWT yet — hand
		// back a short-lived challenge token the frontend must exchange for a
		// real session via /auth/2fa/login-verify.
		if (user.twoFactorEnabled) {
			const challengeToken = await this.jwt.signAsync(
				{ sub: user.id, purpose: 'mfa' },
				{ expiresIn: '5m' },
			);
			return { twoFactorRequired: true, challengeToken };
		}

		return this.issueSession(user);
	}

	async issueSession(user: { id: string; email: string; profileId: number | null; role: string }) {
		const token = await this.jwt.signAsync({
			sub: user.id,
			email: user.email,
			profileId: user.profileId,
			role: user.role,
		});

		return {
			accessToken: token,
			user: { id: user.id, email: user.email, profileId: user.profileId, role: user.role },
		};
	}
	// --- Account changes (email, password) -------------------------------
	// The browser drops its Supabase session right after login (see the
	// frontend's exchangeSupabaseToken), so these routes are the only way to
	// change the email or password, and each one checks the current password
	// here on the server. A stolen app token alone can't move the account to
	// someone else's inbox.

	private static readonly MIN_PASSWORD_LENGTH = 8; // matches minimum_password_length in supabase/config.toml

	// A short-lived client for acting as one user. Never the shared
	// this.supabase: signing in on that would leave a user's session on an
	// instance every request shares.
	private userScopedClient(): SupabaseClient {
		return createClient(
			this.config.get<string>('SUPABASE_AUTH_URL')!,
			this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
			{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
		);
	}

	async getAccount(userId: string) {
		const { data, error } = await this.supabase.auth.admin.getUserById(userId);
		if (error || !data.user) {
			throw new NotFoundException('Account not found');
		}
		const user = data.user;
		const hasGoogle = !!user.identities?.some((i) => i.provider === 'google');
		return {
			email: user.email ?? null,
			pendingEmail: user.new_email ?? null,
			hasPassword: await this.hasPassword(userId, user),
			// Signs in with Google too. If they change the email, they should
			// expect to sign in with email + password from then on.
			hasGoogle,
		};
	}

	// Whether the account can sign in with a password. How it signed up isn't
	// enough: a Google account that later set a password via the reset link
	// still only lists a 'google' identity. Supabase's own auth.users row is the
	// source of truth (only whether a hash exists is read, never the hash).
	private async hasPassword(userId: string, user: { identities?: { provider: string }[] }): Promise<boolean> {
		try {
			const rows = await this.prisma.$queryRaw<{ has: boolean }[]>`
				SELECT (encrypted_password IS NOT NULL AND encrypted_password <> '') AS has
				FROM auth.users WHERE id = ${userId}::uuid`;
			if (rows.length) return rows[0].has;
		} catch (err) {
			// e.g. a local DB without the auth schema: fall back to the sign-up method.
		}
		return !!user.identities?.some((i) => i.provider === 'email');
	}

	private async signInAsUser(userId: string, currentPassword: string) {
		if (!currentPassword) {
			throw new BadRequestException('Current password is required');
		}
		const account = await this.getAccount(userId);
		if (!account.hasPassword || !account.email) {
			throw new BadRequestException('This account has no password yet. Use "Set a password" in Settings first.');
		}
		const client = this.userScopedClient();
		const { error } = await client.auth.signInWithPassword({ email: account.email, password: currentPassword });
		if (error) {
			// 400, not 401: the frontend treats a 401 as "your app session
			// expired" and logs the user out.
			throw new BadRequestException('Current password is incorrect');
		}
		return { client, email: account.email };
	}

	async changeEmail(userId: string, currentPassword: string, newEmail: string) {
		const email = (newEmail ?? '').trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			throw new BadRequestException('Enter a valid email address');
		}
		const { client, email: currentEmail } = await this.signInAsUser(userId, currentPassword);
		try {
			if (email === currentEmail.toLowerCase()) {
				throw new BadRequestException('That is already your email address');
			}
			// Supabase emails a confirmation link to the new address; the switch
			// happens once it's clicked ("Secure email change" is off in
			// production, so the old address isn't asked). loginWithSupabaseToken
			// picks up the new address on the next login.
			const origin = this.config.get<string>('CORS_ORIGIN') ?? '';
			const { error } = await client.auth.updateUser({ email }, { emailRedirectTo: `${origin}/login` });
			if (error) {
				throw new BadRequestException(error.message);
			}
			return { sentTo: email };
		} finally {
			await client.auth.signOut({ scope: 'local' });
		}
	}

	async changePassword(userId: string, currentPassword: string, newPassword: string) {
		if (!newPassword || newPassword.length < AuthService.MIN_PASSWORD_LENGTH) {
			throw new BadRequestException(`New password must be at least ${AuthService.MIN_PASSWORD_LENGTH} characters`);
		}
		if (newPassword === currentPassword) {
			throw new BadRequestException('New password must be different from the current one');
		}
		const { client } = await this.signInAsUser(userId, currentPassword);
		// current_password too: the production Supabase project requires it.
		const { error } = await client.auth.updateUser({ password: newPassword, current_password: currentPassword });
		if (error) {
			await client.auth.signOut({ scope: 'local' });
			throw new BadRequestException(error.message);
		}
		// Ends every Supabase session for this account, e.g. an unused
		// password-reset session. App JWTs are stateless and run until expiry.
		await client.auth.signOut({ scope: 'global' });
		return { ok: true };
	}
}
