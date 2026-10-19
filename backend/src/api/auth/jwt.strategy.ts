import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

// The frontend matches on "must turn on MFA" to send the admin to Settings.
export const ADMIN_MFA_REQUIRED = 'Site admins must turn on MFA before using the admin console. Set it up in Settings.';

export const GUEST_SESSION_ENDED = 'Your guest session ended after 15 minutes without activity.';

// What an admin without MFA may still call: the MFA setup, and the account
// details the Settings page loads.
const ADMIN_MFA_SETUP_ROUTES = [
	'GET /auth/2fa/status',
	'POST /auth/2fa/setup',
	'POST /auth/2fa/enable',
	'GET /auth/account',
];

// "METHOD /path" without the global API prefix or the query string.
function routeOf(req: any): string {
	const prefix = '/' + (process.env.API_PREFIX || 'api');
	let path = String(req.originalUrl ?? req.url ?? '').split('?')[0];
	if (path.startsWith(prefix + '/')) path = path.slice(prefix.length);
	return `${req.method} ${path.replace(/\/+$/, '')}`;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(private readonly prisma: PrismaService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: process.env.JWT_SECRET,
			passReqToCallback: true,
		});
	}

	async validate(req: any, payload: any) {
		// 2FA challenge tokens are only valid for /auth/2fa/login-verify — never
		// as a real bearer token for the rest of the API.
		if (payload.purpose === 'mfa') {
			throw new UnauthorizedException('MFA challenge token cannot be used for authentication');
		}

		// Site admins have their own table (Admin). The token says which table
		// to look in; the row is still read on every request, so a removed
		// admin loses the console on their next request.
		if (payload.role === 'ADMIN') {
			const admin = await this.prisma.admin.findUnique({
				where: { id: payload.sub },
				select: { twoFactorEnabled: true },
			});
			if (!admin) {
				throw new UnauthorizedException('This admin account no longer exists.');
			}
			// Site admins must have MFA. Until they turn it on, their session only
			// reaches what setting it up needs; everything else, the admin console
			// included, is refused.
			if (!admin.twoFactorEnabled && !ADMIN_MFA_SETUP_ROUTES.includes(routeOf(req))) {
				throw new ForbiddenException(ADMIN_MFA_REQUIRED);
			}
			return { id: payload.sub, email: payload.email, profileId: null, role: 'ADMIN' };
		}

		// Checked on every request (not just at login) so a suspension takes
		// effect immediately against an already-issued token, instead of
		// waiting up to JWT_EXPIRES_IN for the session to expire on its own.
		// Same for the role: it comes from the database, not the token, so a
		// demoted moderator loses the moderation endpoints on their next request.
		const user = await this.prisma.user.findUnique({
			where: { id: payload.sub },
			select: { suspended: true, role: true, updatedAt: true },
		});
		// A guest removed after 15 idle minutes (AuthService): say so, rather
		// than "suspended". The frontend matches on "guest session ended".
		if (!user && payload.role === 'GUEST') {
			throw new UnauthorizedException(GUEST_SESSION_ENDED);
		}
		if (!user || user.suspended) {
			throw new UnauthorizedException('Your account has been suspended.');
		}

		// Guests' last activity, which the idle cleanup reads. At most once a
		// minute, so a busy guest doesn't write on every request.
		if (user.role === 'GUEST' && Date.now() - user.updatedAt.getTime() > 60 * 1000) {
			await this.prisma.user.update({ where: { id: payload.sub }, data: { updatedAt: new Date() } });
		}

		return { id: payload.sub, email: payload.email, profileId: payload.profileId, role: user.role };
	}
}
