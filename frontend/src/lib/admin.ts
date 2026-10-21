import { apiFetch } from './auth';

// Requests from the admin console (/admin). Throws with the server's message,
// and with status 401 when the session has expired (the shell signs out then).
export class AdminRequestError extends Error {
	constructor(message: string, public status: number) {
		super(message);
	}
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
		...init,
		headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
	}).catch(() => { throw new AdminRequestError("Can't reach the server.", 0); });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
		throw new AdminRequestError(message || `Request failed (${res.status})`, res.status);
	}
	return data as T;
}

export interface AdminTreeSummary {
	id: number;
	name: string;
	slug: string;
	description: string | null;
	isPublic: boolean;
	createdAt: string;
	updatedAt: string;
	owner: { name: string; username: string | null; email: string | null };
	people: number;
	accounts: number;
}

export interface AdminTreeDetail extends Omit<AdminTreeSummary, 'people' | 'accounts'> {
	people: {
		id: number; name: string; gender: string | null; birthYear: number | null;
		mother: string | null; father: string | null; spouse: string | null;
		claim: string; claimedBy: string | null;
	}[];
	accounts: { id: number; treeRole: string; name: string; username: string | null; email: string | null; joinedAt: string }[];
}

export interface AdminStats {
	users: number;
	roles: Record<string, number>;
	suspended: number;
	mfa: number;
	trees: number;
	people: number;
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString();
