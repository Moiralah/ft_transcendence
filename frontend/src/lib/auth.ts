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
	localStorage.setItem('ft_token', result.accessToken);
	localStorage.setItem('ft_role', result.user.role);
}

export function clearSession() {
	localStorage.removeItem('ft_token');
	localStorage.removeItem('ft_role');
}

export async function exchangeSupabaseToken(accessToken: string): Promise<LoginResult> {
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
