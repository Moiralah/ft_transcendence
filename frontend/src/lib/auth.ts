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

export function storeSession(result: LoginSuccess) {
	sessionStorage.setItem('ft_token', result.accessToken);
	sessionStorage.setItem('ft_role', result.user.role);
}

export function clearSession() {
	sessionStorage.removeItem('ft_token');
	sessionStorage.removeItem('ft_role');
}

export async function exchangeSupabaseToken(accessToken: string): Promise<LoginResult> {
	try {
		const res = await fetch(`${apiUrl()}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accessToken }),
		});
		const data = await res.json();
		if (!res.ok) {
			throw new Error(data.message || 'Login failed');
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
}

export class SessionExpiredError extends Error {}

async function accountRequest<T>(path: string, body?: unknown): Promise<T> {
	const token = sessionStorage.getItem('ft_token');
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
