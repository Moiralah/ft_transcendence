'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { AdminShell } from '@/components/adminShell';
import { Button } from '@/components/button';
import { getRole, getToken, getUserId } from '@/lib/auth';
import { adminRequest } from '@/lib/admin';

interface AdminUser {
	id: string;
	username: string;
	email: string;
	role: 'MODERATOR' | 'USER';
	suspended: boolean;
	twoFactorEnabled: boolean;
	createdAt: string;
	profile?: { firstName: string; lastName?: string | null } | null;
}

// Also served at /moderator/users (suspend only, no role changes or deletes).
// Not ADMIN: admins are separate accounts, added on the Admins tab. Guests
// aren't users either (their own table); only the on/off switch is here.
const ROLES: AdminUser['role'][] = ['MODERATOR', 'USER'];

export default function AdminUsersPage() {
	const router = useRouter();
	const token = getToken();
	const role = getRole();

	const [users, setUsers] = useState<AdminUser[]>([]);
	// A moderator's own row has no actions: they can't change their own role,
	// suspend or delete themselves (the backend refuses too). Admins aren't listed here.
	const [myId, setMyId] = useState<string | null>(null);
	useEffect(() => setMyId(getUserId()), []);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const apiUrl = process.env.NEXT_PUBLIC_API_URL;

	const authedFetch = (path: string, init?: RequestInit) =>
		fetch(`${apiUrl}${path}`, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				...(init?.headers || {}),
			},
		});

	const isAdmin = role === 'ADMIN';
	const isModerator = role === 'MODERATOR';

	useEffect(() => {
		// AdminShell sends everyone else away.
		if (!token || (!isAdmin && !isModerator)) return;
		fetchUsers();
		adminRequest<{ guestAccess: boolean }>('/admin/guest-access')
			.then((r) => setGuestAccess(r.guestAccess))
			.catch(() => {});
	}, [token, role]);

	// "Try as guest" on the front page, on or off.
	const [guestAccess, setGuestAccess] = useState<boolean | null>(null);
	const toggleGuestAccess = async () => {
		const next = !guestAccess;
		if (!next && !confirm('Turn off "Try as guest"? Visitors will be asked to sign up instead. Guests already inside keep their visit until it ends.')) return;
		try {
			const r = await adminRequest<{ guestAccess: boolean }>('/admin/guest-access', {
				method: 'PATCH',
				body: JSON.stringify({ guestAccess: next }),
			});
			setGuestAccess(r.guestAccess);
			toast.success(r.guestAccess ? 'Guest access is on.' : 'Guest access is off.');
		} catch (err: any) {
			toast.error(err.message);
		}
	};

	const fetchUsers = async () => {
		try {
			const res = await authedFetch('/users');
			if (res.status === 403) {
				router.replace('/dashboard');
				return;
			}
			if (!res.ok) throw new Error('Failed to load users');
			setUsers(await res.json());
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const changeRole = async (id: string, username: string, newRole: AdminUser['role']) => {
		if (!confirm(`Change ${username}'s role to ${newRole}?`)) return;
		setError(null);
		try {
			const res = await authedFetch(`/users/${id}/role`, {
				method: 'PATCH',
				body: JSON.stringify({ role: newRole }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Failed to change role');
			setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
			toast.success(`${username} is now ${newRole}.`);
		} catch (err: any) {
			setError(err.message);
			toast.error(err.message);
		}
	};

	const toggleSuspended = async (id: string, username: string, suspended: boolean) => {
		if (suspended && !confirm(`Suspend ${username}? They will be logged out immediately and unable to sign in until unsuspended.`)) return;
		setError(null);
		try {
			const res = await authedFetch(`/users/${id}/suspend`, {
				method: 'PATCH',
				body: JSON.stringify({ suspended }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Failed to update suspension');
			setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, suspended } : u)));
			toast.success(suspended ? `${username} suspended.` : `${username} unsuspended.`);
		} catch (err: any) {
			setError(err.message);
			toast.error(err.message);
		}
	};

	const deleteUser = async (id: string, username: string) => {
		if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
		setError(null);
		try {
			const res = await authedFetch(`/users/${id}`, { method: 'DELETE' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Failed to delete user');
			setUsers((prev) => prev.filter((u) => u.id !== id));
			toast.success(`${username} deleted.`);
		} catch (err: any) {
			setError(err.message);
			toast.error(err.message);
		}
	};

	return (
		<AdminShell title="User management">
				{error && <div role="alert" className="text-red-700 font-semibold">{error}</div>}

				{guestAccess !== null && (
					<section aria-labelledby="guest-access-heading" className="bg-white p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 id="guest-access-heading" className="font-bold">Try as guest</h2>
							<p className="text-sm text-slate-700">
								{guestAccess ? 'On: visitors can try the site with a demo tree, without signing up.' : 'Off: visitors must sign up to try the site.'}
							</p>
						</div>
						<Button variant="secondary" onClick={toggleGuestAccess}>
							{guestAccess ? 'Turn off' : 'Turn on'}
						</Button>
					</section>
				)}

				{loading ? (
					<p aria-live="polite">Loading users...</p>
				) : (
					<div className="relative overflow-x-auto bg-white rounded-lg border border-slate-200">
						<table className="w-full text-sm text-left">
							<caption className="sr-only">All registered users</caption>
							<thead className="bg-slate-100 text-slate-700">
								<tr>
									<th scope="col" className="px-4 py-3">Username</th>
									<th scope="col" className="px-4 py-3">Email</th>
									<th scope="col" className="px-4 py-3">Role</th>
									<th scope="col" className="px-4 py-3">Status</th>
									<th scope="col" className="px-4 py-3">MFA</th>
									<th scope="col" className="px-4 py-3">Joined</th>
									<th scope="col" className="px-4 py-3">
										<span className="sr-only">Actions</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{users.map((u) => {
									const isMe = u.id === myId;
									const canSuspend = !isMe;
									return (
										<tr key={u.id} className="border-t border-slate-200">
											<td className="px-4 py-3">{u.username}{isMe && <span className="ml-2 text-xs font-semibold text-slate-600">(you)</span>}</td>
											<td className="px-4 py-3">{u.email}</td>
											<td className="px-4 py-3">
												{isAdmin && !isMe ? (
													<>
														<label className="sr-only" htmlFor={`role-${u.id}`}>
															Role for {u.username}
														</label>
														<select
															id={`role-${u.id}`}
															value={u.role}
															onChange={(e) => changeRole(u.id, u.username, e.target.value as AdminUser['role'])}
															className="border border-slate-300 rounded-md px-2 py-1"
														>
															{ROLES.map((r) => (
																<option key={r} value={r}>{r}</option>
															))}
														</select>
													</>
												) : (
													u.role
												)}
											</td>
											<td className="px-4 py-3">
												{u.suspended ? (
													<span className="text-red-700 font-semibold">Suspended</span>
												) : (
													<span className="text-emerald-700">Active</span>
												)}
											</td>
											<td className="px-4 py-3">{u.twoFactorEnabled ? 'Enabled' : '—'}</td>
											<td className="px-4 py-3">{new Date(u.createdAt).toLocaleDateString()}</td>
											<td className="px-4 py-3">
												<div className="flex gap-2 whitespace-nowrap">
													{canSuspend && (
														<Button
															variant="ghost"
															onClick={() => toggleSuspended(u.id, u.username, !u.suspended)}
															aria-label={`${u.suspended ? 'Unsuspend' : 'Suspend'} user ${u.username}`}
														>
															{u.suspended ? 'Unsuspend' : 'Suspend'}
														</Button>
													)}
													{isAdmin && !isMe && (
														<Button
															variant="ghost"
															onClick={() => deleteUser(u.id, u.username)}
															aria-label={`Delete user ${u.username}`}
														>
															Delete
														</Button>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
		</AdminShell>
	);
}
