import type { Request, Response } from 'express';

// The session token travels in an HttpOnly cookie, never in a response body or
// an Authorization header: page JavaScript (an XSS bug included) can't read it.
// One session per browser: every tab shares the cookie.
//   Secure        HTTPS only (localhost is HTTPS here too)
//   SameSite      Strict: another site can't make the browser send it
//   Path          the API only; the pages never need it
export const SESSION_COOKIE = 'ft_session';

function cookieOptions() {
	return {
		httpOnly: true,
		secure: true,
		sameSite: 'strict' as const,
		path: '/' + (process.env.API_PREFIX || 'api'),
	};
}

// Turns a session from AuthService.issueSession into the response body:
// the token goes into the cookie, the rest (user, flags, slug) stays.
// An MFA challenge (no accessToken yet) passes through unchanged.
// expiresAt (ms) tells the frontend when the session ends, without the token.
export function withSessionCookie<T extends object>(res: Response, result: T): Omit<T, 'accessToken'> & { expiresAt?: number } {
	const { accessToken, ...rest } = result as T & { accessToken?: string };
	if (!accessToken) return rest;
	const seconds = Number(process.env.JWT_EXPIRES_IN) || 3600;
	res.cookie(SESSION_COOKIE, accessToken, { ...cookieOptions(), maxAge: seconds * 1000 });
	return { ...rest, expiresAt: Date.now() + seconds * 1000 };
}

export function clearSessionCookie(res: Response) {
	res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// JwtStrategy's token extractor (no cookie-parser needed for one cookie).
export function sessionTokenFrom(req: Request): string | null {
	for (const part of (req.headers.cookie ?? '').split(';')) {
		const eq = part.indexOf('=');
		if (eq > 0 && part.slice(0, eq).trim() === SESSION_COOKIE) {
			return decodeURIComponent(part.slice(eq + 1).trim()) || null;
		}
	}
	return null;
}
