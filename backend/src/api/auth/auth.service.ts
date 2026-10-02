
import { Injectable, UnauthorizedException } from '@nestjs/common';
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
}
