import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(private readonly prisma: PrismaService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: process.env.JWT_SECRET,
		});
	}

	async validate(payload: any) {
		// 2FA challenge tokens are only valid for /auth/2fa/login-verify — never
		// as a real bearer token for the rest of the API.
		if (payload.purpose === 'mfa') {
			throw new UnauthorizedException('MFA challenge token cannot be used for authentication');
		}

		// Checked on every request (not just at login) so a suspension takes
		// effect immediately against an already-issued token, instead of
		// waiting up to JWT_EXPIRES_IN for the session to expire on its own.
		const user = await this.prisma.user.findUnique({
			where: { id: payload.sub },
			select: { suspended: true },
		});
		if (!user || user.suspended) {
			throw new UnauthorizedException('Your account has been suspended.');
		}

		return { id: payload.sub, email: payload.email, profileId: payload.profileId, role: payload.role };
	}
}
