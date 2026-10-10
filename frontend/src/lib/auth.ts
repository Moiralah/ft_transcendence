import { supabase } from './supabaseClient';

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL;

export interface LoginSuccess {
	accessToken: string;
	user: { id: string; email: string; profileId: number | null; role: string };
}

export interface TwoFactorRequired {
	twoFactorRequired: true;
	challengeToken: string;
}

export type LoginResult = LoginSuccess | TwoFactorRequired;

export function isTwoFactorRequired(result: LoginResult): result is TwoFactorRequired {
	return (result as TwoFactorRequired).twoFactorRequired === true;
}

// Keep in sync with minimum_password_length in supabase/config.toml, which is
// what actually enforces it server-side (this only gives a friendlier message).
export const MIN_PASSWORD_LENGTH = 8;

// --- The app session (our own JWT + role) ---------------------------------
// This file is the only place that knows where the session is kept. Use
// getToken()/getRole()/storeSession()/clearSession() instead of touching
// browser storage directly: it moved from localStorage to sessionStorage on
// 2026-10-01 (tab-isolated, gone when the tab closes), and code that still
// read localStorage silently found no token and acted logged out.
const TOKEN_KEY = 'ft_token';
const ROLE_KEY = 'ft_role';

export function getToken(): string | null {
	if (typeof window === 'undefined') return null; // server render: no session
	return sessionStorage.getItem(TOKEN_KEY);
}

// UX only (e.g. showing the admin link). The backend checks the role in the
// signed JWT; editing this value grants nothing.
export function getRole(): string | null {
	if (typeof window === 'undefined') return null;
	return sessionStorage.getItem(ROLE_KEY);
}

export function storeSession(result: LoginSuccess) {
	sessionStorage.setItem(TOKEN_KEY, result.accessToken);
	sessionStorage.setItem(ROLE_KEY, result.user.role);
}

export function clearSession() {
	sessionStorage.removeItem(TOKEN_KEY);
	sessionStorage.removeItem(ROLE_KEY);
}

// --- Handing the session to a new tab -------------------------------------
// Each tab keeps its own session (above), so a new tab used to start logged
// out. Now a new tab asks the other open tabs of this site once; a logged-in
// tab answers with its token, and from then on the two tabs are independent
// again (logging out or switching account in one doesn't touch the other).
// BroadcastChannel only reaches tabs of this same origin.
const SESSION_CHANNEL = 'ft-session';
const BORROWED_AT_KEY = 'ft_borrowed_at';

// Only hand over (or accept) a token that is still valid for a while, so a
// new tab never loops between /login and a 401 on an expired session.
function tokenStillValid(token: string, marginMs = 60_000): boolean {
	try {
		const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
		return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + marginMs;
	} catch {
		return false;
	}
}

// Runs in every tab (see components/sessionShare.tsx): answers new tabs.
export function answerSessionRequests(): () => void {
	if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return () => {};
	const channel = new BroadcastChannel(SESSION_CHANNEL);
	channel.onmessage = (event) => {
		if (event.data?.type !== 'request') return;
		const token = getToken();
		const role = getRole();
		if (token && role && tokenStillValid(token)) {
			channel.postMessage({ type: 'session', id: event.data.id, token, role });
		}
	};
	return () => channel.close();
}

// Called by /login: resolves true if another tab handed over a session.
// At most once per 30 s per tab, so a suspended account can't loop.
export function borrowSessionFromOtherTab(timeoutMs = 400): Promise<boolean> {
	if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return Promise.resolve(false);
	if (getToken()) return Promise.resolve(true);
	const last = Number(sessionStorage.getItem(BORROWED_AT_KEY) || 0);
	if (Date.now() - last < 30_000) return Promise.resolve(false);
	return new Promise((resolve) => {
		const channel = new BroadcastChannel(SESSION_CHANNEL);
		const id = Math.random().toString(36).slice(2);
		const finish = (ok: boolean) => {
			clearTimeout(timer);
			channel.close();
			resolve(ok);
		};
		const timer = setTimeout(() => finish(false), timeoutMs);
		channel.onmessage = (event) => {
			const { type, id: replyTo, token, role } = event.data || {};
			if (type !== 'session' || replyTo !== id || getToken() || !tokenStillValid(token)) return;
			sessionStorage.setItem(TOKEN_KEY, token);
			sessionStorage.setItem(ROLE_KEY, role);
			sessionStorage.setItem(BORROWED_AT_KEY, String(Date.now()));
			finish(true);
		};
		channel.postMessage({ type: 'request', id });
	});
}

// --- Login errors shown to people ---------------------------------------------
// One wording for a suspended account, wherever it's detected: at login (email or
// Google) or mid-session (the backend checks suspension on every request).
export const SUSPENDED_MESSAGE =
	'This account has been suspended. If you think this is a mistake, please contact the site administrator through the feedback page.';

// Keeps the HTTP status, so callers can tell "suspended" (403) from other failures.
export class LoginError extends Error {
	constructor(message: string, public readonly status: number) {
		super(message);
	}
}

export function isSuspended(err: unknown): boolean {
	return err instanceof LoginError && err.status === 403 && /suspended/i.test(err.message);
}

// /login?error=<code> -> what the login page shows.
export function loginErrorMessage(code: string | null): string | null {
	if (code === 'suspended') return SUSPENDED_MESSAGE;
	if (code === 'BackendError') return "We couldn't sign you in right now. Please try again in a moment.";
	if (code === 'SessionError') return "Your sign-in didn't complete. Please try again.";
	return null;
}

// After a 401 on an API call: back to /login, saying why if the account was suspended.
export async function loginPathAfter401(res: Response): Promise<string> {
	try {
		const data = await res.clone().json();
		if (/suspended/i.test(String(data?.message ?? ''))) return '/login?error=suspended';
	} catch {
		// not JSON: plain expired session
	}
	return '/login';
}

export async function exchangeSupabaseToken(accessToken: string): Promise<LoginResult> {
	try {
		const res = await fetch(`${apiUrl()}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accessToken }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			throw new LoginError(data.message || 'Login failed', res.status);
		}
		return data;
	} finally {
		// From here on the app only uses its own token. Dropping the Supabase
		// session means a stolen browser session can't call Supabase directly
		// to change the email or password; those go through the backend, which
		// checks the current password (see /auth/change-email, /change-password).
		await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
	}
}

export async function verifyTwoFactorLogin(challengeToken: string, code: string): Promise<LoginSuccess> {
	const res = await fetch(`${apiUrl()}/auth/2fa/login-verify`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ challengeToken, code }),
	});
	const data = await res.json();
	if (!res.ok) {
		throw new Error(data.message || 'Invalid code');
	}
	return data;
}

// --- Account settings (backend routes; the browser has no Supabase session) --

export interface AccountInfo {
	email: string | null;
	pendingEmail: string | null;
	hasPassword: boolean;
	hasGoogle: boolean;
}

export class SessionExpiredError extends Error {}

async function accountRequest<T>(path: string, body?: unknown): Promise<T> {
	const token = getToken();
	if (!token) throw new SessionExpiredError('Not logged in');
	const res = await fetch(`${apiUrl()}/auth/${path}`, {
		method: body === undefined ? 'GET' : 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const data = await res.json().catch(() => ({}));
	if (res.status === 401) {
		clearSession();
		throw new SessionExpiredError(data.message || 'Your session has expired');
	}
	if (!res.ok) {
		throw new Error(data.message || 'Something went wrong');
	}
	return data as T;
}

export const getAccount = () => accountRequest<AccountInfo>('account');

export const changeEmail = (currentPassword: string, newEmail: string) =>
	accountRequest<{ sentTo: string }>('change-email', { currentPassword, newEmail });

export const changePassword = (currentPassword: string, newPassword: string) =>
	accountRequest<{ ok: true }>('change-password', { currentPassword, newPassword });

// For accounts with no password yet (signed up with Google): emails the same
// link as "Forgot password". Setting a password there adds an email + password
// login to the same account, after which Change email works too.
export async function sendSetPasswordEmail(email: string) {
	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${window.location.origin}/reset-password`,
	});
	if (error) throw new Error(error.message);
}
