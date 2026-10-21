import { supabase } from './supabaseClient';

const apiUrl = () => process.env.NEXT_PUBLIC_API_URL;

export interface LoginSuccess {
	// The token itself is in the HttpOnly session cookie, not here.
	expiresAt: number;
	user: { id: string; email: string; profileId: number | null; role: string };
	// A site admin without MFA (the session only reaches MFA setup until it's
	// on), or a moderator without it (can't moderate until it's on): land on MFA setup.
	twoFactorSetupRequired?: boolean;
}

// Where a site admin or moderator without MFA is sent (the backend refuses an
// admin everything else, a moderator moderation, until it's on).
export const ADMIN_MFA_SETUP_PATH = '/settings?mfa=required';

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

// --- The app session ---------------------------------------------------------
// The session token itself is an HttpOnly cookie the backend sets (21 Oct 2026):
// this code never sees it, and neither would a script injected into the page.
// What's kept here is only a readable note of who is signed in (account id,
// role, when the session ends), for the UI: which page to show, which links.
// It grants nothing; the backend checks the cookie on every request. Like the
// cookie, it's shared by every tab of this browser: one session per browser.
const SESSION_KEY = 'ft_session';
// A guest's own demo tree (its slug): a guest's home, since guests have no dashboard.
const GUEST_TREE_KEY = 'ft_guest_tree';

interface SessionNote { id: string; role: string; expiresAt: number }

// The note as stored, ended or not.
function storedSession(): SessionNote | null {
	if (typeof window === 'undefined') return null; // server render: no session
	try {
		return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as SessionNote | null;
	} catch {
		return null; // unreadable: treat as signed out
	}
}

function readSession(): SessionNote | null {
	const note = storedSession();
	return note && note.expiresAt > Date.now() ? note : null;
}

// Every call to our API: sends the session cookie along (the API is another
// origin on localhost, so the browser wouldn't by default).
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
	return fetch(input, { ...init, credentials: 'include' });
}

export function rememberGuestTree(slug: string) {
	localStorage.setItem(GUEST_TREE_KEY, slug);
}

// The signed-in account's id, or null. "Am I signed in?" for the UI; the
// backend checks the real session (the cookie).
export function getSessionId(): string | null {
	return readSession()?.id ?? null;
}

// UX only (e.g. showing the admin link). The backend reads the role from the
// database on every request; editing this value grants nothing.
export function getRole(): string | null {
	return readSession()?.role ?? null;
}

export function storeSession(result: LoginSuccess) {
	const note: SessionNote = { id: result.user.id, role: result.user.role, expiresAt: result.expiresAt };
	localStorage.setItem(SESSION_KEY, JSON.stringify(note));
}

// Keeps the stored role in step with the server (from GET /profile/me), so a
// role change made by an admin shows up without logging out and back in.
export function updateRole(role: string) {
	const note = readSession();
	if (note) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...note, role }));
}

// Forgets the note only; the cookie is ended by the backend (logOut()), or
// has already been refused (a 401).
export function clearSession() {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(SESSION_KEY);
	localStorage.removeItem(GUEST_TREE_KEY);
}

// The signed-in account's id, e.g. to mark "you" in the admin's user list.
export const getUserId = getSessionId;

// Where a tab goes once logged out: staff accounts sign in on /staff.
const logoutPath = () => (getRole() === 'ADMIN' ? '/staff' : '/login');

// The Logout button: the backend stops accepting this session (POST
// /auth/logout revokes it and clears the cookie), then every tab of this
// browser follows (watchSessionInOtherTabs). Returns where to go.
export async function logOut(): Promise<string> {
	const path = logoutPath();
	if (getSessionId()) {
		// Logging out still happens here if the server can't be reached.
		await apiFetch(`${apiUrl()}/auth/logout`, { method: 'POST', keepalive: true }).catch(() => {});
	}
	clearSession();
	return path;
}

// Pages a signed-out visitor can stay on: an ending session isn't a reason to
// leave them.
const PUBLIC_PATHS = ['/', '/login', '/signup', '/staff', '/guest', '/consent', '/forgot-password', '/reset-password', '/privacy', '/terms', '/feedback'];

// Runs in every tab (components/sessionShare.tsx). All tabs share one session,
// so when another tab signs out, or signs in as someone else, this tab
// reloads into the new state instead of acting for the old account.
export function watchSessionInOtherTabs(): () => void {
	if (typeof window === 'undefined') return () => {};
	let current = getSessionId();
	let endsAt = storedSession()?.expiresAt ?? 0;
	const onStorage = (event: StorageEvent) => {
		if (event.key !== SESSION_KEY && event.key !== null) return;
		const now = getSessionId();
		if (now === current) return;
		// Signed out because the hour ran out (the note is past its end, or
		// another tab already dropped it at the end): say so, like that tab does.
		const stored = storedSession();
		const expired = !now && (stored ? stored.expiresAt : endsAt) <= Date.now();
		current = now;
		endsAt = stored?.expiresAt ?? 0;
		if (now) window.location.replace(homeFor(getRole()));
		// A public page stays put; there's nothing on it to leave.
		else if (!PUBLIC_PATHS.includes(window.location.pathname)) window.location.replace(expired ? '/login?error=expired' : '/login');
	};
	window.addEventListener('storage', onStorage);
	return () => window.removeEventListener('storage', onStorage);
}

// Runs in every tab (components/sessionShare.tsx). When the session's hour is
// up, the server already refuses the cookie; this makes the page follow at
// once, instead of leaving it on screen until the next click fails: the note
// is dropped and a signed-in page goes to sign-in, saying why. Checked every
// 15 s and whenever the tab is shown again (background tabs' timers are
// slowed, and a laptop may have slept past the end).
export function watchSessionExpiry(): () => void {
	if (typeof window === 'undefined') return () => {};
	const check = () => {
		const note = storedSession();
		if (!note || note.expiresAt > Date.now()) return;
		const path = note.role === 'ADMIN' ? '/staff?error=expired' : '/login?error=expired';
		clearSession();
		if (!PUBLIC_PATHS.includes(window.location.pathname)) window.location.replace(path);
	};
	const onVisible = () => {
		if (document.visibilityState === 'visible') check();
	};
	check();
	const timer = window.setInterval(check, 15_000);
	document.addEventListener('visibilitychange', onVisible);
	return () => {
		window.clearInterval(timer);
		document.removeEventListener('visibilitychange', onVisible);
	};
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

// fetch() rejects (no HTTP status at all) when the browser can't reach the API.
// Locally that's nearly always the API's self-signed certificate not accepted
// yet in this browser: each browser, and each port, needs it once.
export function apiUnreachableMessage(): string {
	const origin = (() => { try { return new URL(apiUrl() ?? '').origin; } catch { return 'the API'; } })();
	return `Can't reach the server. Open ${origin} once in this browser, accept its certificate, then sign in again.`;
}

export function isApiUnreachable(err: unknown): boolean {
	return err instanceof LoginError && err.status === 0;
}

export function isSuspended(err: unknown): boolean {
	return err instanceof LoginError && err.status === 403 && /suspended/i.test(err.message);
}

// /login?error=<code> -> what the login page shows.
export function loginErrorMessage(code: string | null): string | null {
	if (code === 'suspended') return SUSPENDED_MESSAGE;
	if (code === 'expired') return 'Your session ended after 1 hour. Please sign in again.';
	if (code === 'ApiUnreachable') return apiUnreachableMessage();
	if (code === 'BackendError') return "We couldn't sign you in right now. Please try again in a moment.";
	if (code === 'SessionError') return "Your sign-in didn't complete. Please try again.";
	if (code === 'StaffOnly') return 'Staff accounts sign in through "Sign in as staff", with email and password.';
	if (code === 'NotStaff') return 'This is not a staff account. Sign in on the normal login page.';
	return null;
}

// --- Two sign-in pages, like 42's "Sign in as staff" ------------------------
// /login is for users and moderators, /staff for admins; the backend refuses
// an account on the wrong one (403 mentioning "staff").
export type Portal = 'member' | 'staff';
const PORTAL_KEY = 'ft_portal';

export function isWrongPortal(err: unknown): boolean {
	return err instanceof LoginError && err.status === 403 && /staff/i.test(err.message);
}

// Google sign-in leaves the site and comes back on /consent; this remembers
// which page it started from (a query string on the redirect URL would have
// to be added to Supabase's allow list).
export function rememberPortal(portal: Portal) {
	sessionStorage.setItem(PORTAL_KEY, portal);
}

export function takePortal(): Portal {
	const portal = sessionStorage.getItem(PORTAL_KEY) === 'staff' ? 'staff' : 'member';
	sessionStorage.removeItem(PORTAL_KEY);
	return portal;
}

export const portalPath = (portal: Portal) => (portal === 'staff' ? '/staff' : '/login');

// Where /consent sends a Google sign-in the backend refused for the wrong page.
export const wrongPortalPath = (portal: Portal) => (portal === 'staff' ? '/staff?error=NotStaff' : '/login?error=StaffOnly');

// Where a session lands: site admins have the admin console instead of the
// member dashboard (they don't make trees or friends); a guest has only its
// demo tree.
export function homeFor(role: string | null): string {
	if (role === 'ADMIN') return '/admin';
	if (role === 'GUEST') return '/';
	return '/dashboard';
}

// After a 401 on an API call: back to /login, saying why if the account was suspended.
export async function loginPathAfter401(res: Response): Promise<string> {
	try {
		const data = await res.clone().json();
		const message = String(data?.message ?? '');
		if (/suspended/i.test(message)) return '/login?error=suspended';
		// A guest removed after 15 idle minutes: back to the front page, which says so.
		if (/guest session ended/i.test(message)) return '/?guest=ended';
	} catch {
		// not JSON: plain expired session
	}
	return '/login';
}

export async function exchangeSupabaseToken(accessToken: string, portal: Portal = 'member'): Promise<LoginResult> {
	try {
		const res = await apiFetch(`${apiUrl()}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(portal === 'staff' ? { accessToken, portal } : { accessToken }),
		}).catch(() => { throw new LoginError(apiUnreachableMessage(), 0); });
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

// "Try as guest": a session on a new guest account (site role GUEST) of this
// visit's own, and the slug of its copy of the demo tree. No Supabase login involved.
export async function loginAsGuest(): Promise<LoginSuccess & { slug: string }> {
	const res = await apiFetch(`${apiUrl()}/auth/guest`, { method: 'POST' })
		.catch(() => { throw new LoginError(apiUnreachableMessage(), 0); });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new LoginError(data.message || 'Guest login failed', res.status);
	}
	return data;
}

// UX only, like getRole(): the backend refuses account changes for the guest.
export function isGuest(): boolean {
	return getRole() === 'GUEST';
}

export async function verifyTwoFactorLogin(challengeToken: string, code: string): Promise<LoginSuccess> {
	const res = await apiFetch(`${apiUrl()}/auth/2fa/login-verify`, {
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

async function accountRequest<T>(path: string, body?: unknown, method?: 'DELETE'): Promise<T> {
	if (!getSessionId()) throw new SessionExpiredError('Not logged in');
	const res = await apiFetch(`${apiUrl()}/auth/${path}`, {
		method: method ?? (body === undefined ? 'GET' : 'POST'),
		headers: { 'Content-Type': 'application/json' },
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

// currentPassword is ignored for accounts without one (Google-only).
export const deleteAccount = (currentPassword: string, confirm: string) =>
	accountRequest<{ message: string; deletedTrees: number }>('account', { currentPassword, confirm }, 'DELETE');

// For accounts with no password yet (signed up with Google): emails the same
// link as "Forgot password". Setting a password there adds an email + password
// login to the same account, after which Change email works too.
export async function sendSetPasswordEmail(email: string) {
	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${window.location.origin}/reset-password`,
	});
	if (error) throw new Error(error.message);
}
