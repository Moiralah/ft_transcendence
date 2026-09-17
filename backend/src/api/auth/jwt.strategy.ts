import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor() {
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
		return { id: payload.sub, email: payload.email, profileId: payload.profileId, role: payload.role };
	}
}
