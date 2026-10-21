import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { sessionTokenFrom } from './session-cookie';

// The frontend matches on "must turn on MFA" to send the admin to Settings.
export const ADMIN_MFA_REQUIRED = 'Site admins must turn on MFA before using the admin console. Set it up in Settings.';

// Moderators must have MFA too, but only for the moderation endpoints
// (RolesGuard): the rest of the app is their member account, which stays open.
export const MODERATOR_MFA_REQUIRED = 'Moderators must turn on MFA before using the moderation console. Set it up in Settings.';

export const GUEST_SESSION_ENDED = 'Your guest session ended after 15 minutes without activity.';

// What an admin without MFA may still call: the MFA setup, and the account
// details the Settings page loads.
const ADMIN_MFA_SETUP_ROUTES = [
	'GET /auth/2fa/status',
	'POST /auth/2fa/setup',
	'POST /auth/2fa/enable',
	'GET /auth/account',
	'POST /auth/logout',
];

export const SESSION_ENDED = 'This session was logged out. Please sign in again.';

// The frontend matches on "password was changed" to say why on the login page.
export const PASSWORD_CHANGED = 'Your password was changed, so every session was signed out. Please sign in with the new password.';

// RevokedToken's name for "every session of this account issued until now"
// (AuthService.endAllSessions). Never a real jti: those are UUIDs, no colon.
export const allSessionsKey = (accountId: string) => `all:${accountId}`;

// MFA is on for the account, but this session never passed it (it was issued
// before MFA was turned on). A 401 so the frontend sends them to sign in again.
export const MFA_SESSION_REQUIRED = 'Please sign in again with your MFA code.';

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
			// The HttpOnly session cookie (session-cookie.ts), not an Authorization header.
			jwtFromRequest: sessionTokenFrom,
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

		// Every session token has a jti (AuthService.issueSession); one without is
		// from before Logout could end sessions, so it's refused too. A token
		// logged out (POST /auth/logout) is listed in RevokedToken until it expires.
		// So is a password change or reset: one row for the whole account, which
		// ends every session that expires no later than it (issued before it).
		if (typeof payload.jti !== 'string') {
			throw new UnauthorizedException(SESSION_ENDED);
		}
		const revoked = await this.prisma.revokedToken.findMany({
			where: { jti: { in: [payload.jti, allSessionsKey(payload.sub)] } },
		});
		if (revoked.some((r) => r.jti === payload.jti)) {
			throw new UnauthorizedException(SESSION_ENDED);
		}
		if (revoked.some((r) => payload.exp * 1000 <= r.expiresAt.getTime())) {
			throw new UnauthorizedException(PASSWORD_CHANGED);
		}
		// What POST /auth/logout needs to list this token.
		const session = { jti: payload.jti as string, exp: payload.exp as number };

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
			// The account having MFA isn't enough: this session must have passed it.
			if (!ADMIN_MFA_SETUP_ROUTES.includes(routeOf(req))) {
				if (!admin.twoFactorEnabled) throw new ForbiddenException(ADMIN_MFA_REQUIRED);
				if (payload.mfa !== true) throw new UnauthorizedException(MFA_SESSION_REQUIRED);
			}
			return { id: payload.sub, email: payload.email, profileId: null, role: 'ADMIN', ...session };
		}

		// Guests have their own table (Guest) too. A guest removed after 15 idle
		// minutes (AuthService): say so, rather than "suspended". The frontend
		// matches on "guest session ended".
		if (payload.role === 'GUEST') {
			const guest = await this.prisma.guest.findUnique({
				where: { id: payload.sub },
				select: { profileId: true, lastSeenAt: true },
			});
			if (!guest) {
				throw new UnauthorizedException(GUEST_SESSION_ENDED);
			}
			// The guest's last activity, which the idle cleanup reads. At most once
			// a minute, so a busy guest doesn't write on every request.
			if (Date.now() - guest.lastSeenAt.getTime() > 60 * 1000) {
				await this.prisma.guest.update({ where: { id: payload.sub }, data: { lastSeenAt: new Date() } });
			}
			return { id: payload.sub, email: payload.email, profileId: guest.profileId, role: 'GUEST', ...session };
		}

		// Checked on every request (not just at login) so a suspension takes
		// effect immediately against an already-issued token, instead of
		// waiting up to JWT_EXPIRES_IN for the session to expire on its own.
		// Same for the role: it comes from the database, not the token, so a
		// demoted moderator loses the moderation endpoints on their next request.
		const user = await this.prisma.user.findUnique({
			where: { id: payload.sub },
			select: { suspended: true, role: true, twoFactorEnabled: true },
		});
		if (!user || user.suspended) {
			throw new UnauthorizedException('Your account has been suspended.');
		}

		// mfa: read by RolesGuard, which refuses moderation to a moderator without
		// it. mfaSession: MFA is on and this session passed it (issueSession).
		return {
			id: payload.sub, email: payload.email, profileId: payload.profileId, role: user.role,
			mfa: user.twoFactorEnabled, mfaSession: user.twoFactorEnabled && payload.mfa === true, ...session,
		};
	}
}
