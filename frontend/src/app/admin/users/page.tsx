'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { AdminShell } from '@/components/adminShell';
import { Button } from '@/components/button';
import { getRole, getToken, getUserId } from '@/lib/auth';

interface AdminUser {
	id: string;
	username: string;
	email: string;
	role: 'ADMIN' | 'MODERATOR' | 'USER' | 'GUEST';
	suspended: boolean;
	twoFactorEnabled: boolean;
	createdAt: string;
	profile?: { firstName: string; lastName?: string | null } | null;
}

// GUEST isn't offered: it's only the shared guest account, whose role can't change.
const ROLES: AdminUser['role'][] = ['ADMIN', 'MODERATOR', 'USER'];

export default function AdminUsersPage() {
	const router = useRouter();
	const token = getToken();
	const role = getRole();

	const [users, setUsers] = useState<AdminUser[]>([]);
	// Your own row has no actions: you can't change your own role, suspend or
	// delete yourself (the backend refuses too), but you can do it to other admins.
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
	}, [token, role]);

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
		const question = newRole === 'ADMIN'
			? `Make ${username} a site admin? Admin accounts sign in only through "Sign in as staff" with email and password, and can't use trees or friends: ${username} loses access to their own trees.`
			: `Change ${username}'s role to ${newRole}?`;
		if (!confirm(question)) return;
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
		<AdminShell title="User management" allowModerator>
				{error && <div role="alert" className="text-red-700 font-semibold">{error}</div>}

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
									const canSuspend = !isMe && (!isModerator || u.role !== 'ADMIN');
									return (
										<tr key={u.id} className="border-t border-slate-200">
											<td className="px-4 py-3">{u.username}{isMe && <span className="ml-2 text-xs font-semibold text-slate-600">(you)</span>}</td>
											<td className="px-4 py-3">{u.email}</td>
											<td className="px-4 py-3">
												{isAdmin && !isMe && u.role !== 'GUEST' ? (
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
