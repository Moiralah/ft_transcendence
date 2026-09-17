
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

		// 2. Find or create user in local database (using Prisma)
		let user = await this.prisma.user.findUnique({
			where: { email: supabaseUser.email },
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
