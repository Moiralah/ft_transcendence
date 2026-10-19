'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { AdminShell } from '@/components/adminShell';
import { Button } from '@/components/button';
import { getRole, getUserId } from '@/lib/auth';
import { adminRequest, formatDate } from '@/lib/admin';

interface AdminAccount {
	id: string;
	username: string;
	email: string;
	twoFactorEnabled: boolean;
	createdAt: string;
}

// Site admin accounts. They are separate from users (their own table, their
// own login), so an admin is added here with an email of its own rather than
// by changing a user's role.
export default function AdminAccountsPage() {
	const [admins, setAdmins] = useState<AdminAccount[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [myId, setMyId] = useState<string | null>(null);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [adding, setAdding] = useState(false);

	useEffect(() => {
		setMyId(getUserId());
		if (getRole() !== 'ADMIN') return; // the shell redirects
		adminRequest<AdminAccount[]>('/admin/admins').then(setAdmins).catch((e) => setError(e.message));
	}, []);

	const addAdmin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setAdding(true);
		try {
			const admin = await adminRequest<AdminAccount>('/admin/admins', {
				method: 'POST',
				body: JSON.stringify({ email, password }),
			});
			setAdmins((prev) => [...(prev ?? []), admin]);
			setEmail('');
			setPassword('');
			toast.success(`${admin.email} is now a site admin.`);
		} catch (err: any) {
			setError(err.message);
			toast.error(err.message);
		} finally {
			setAdding(false);
		}
	};

	const removeAdmin = async (admin: AdminAccount) => {
		if (!confirm(`Remove the admin account ${admin.email}? Its login is deleted and it can no longer sign in as staff.`)) return;
		setError(null);
		try {
			await adminRequest(`/admin/admins/${admin.id}`, { method: 'DELETE' });
			setAdmins((prev) => (prev ?? []).filter((a) => a.id !== admin.id));
			toast.success(`${admin.email} removed.`);
		} catch (err: any) {
			setError(err.message);
			toast.error(err.message);
		}
	};

	return (
		<AdminShell title="Admin accounts">
			<p className="text-slate-700">
				Admin accounts are separate from member accounts: each needs an email that isn&apos;t used by a member.
				They sign in through &quot;Sign in as staff&quot; and must set up MFA first.
			</p>
			{error && <p role="alert" className="text-red-700 font-semibold">{error}</p>}

			{!admins && !error && <p aria-live="polite">Loading…</p>}
			{admins && (
				<div className="relative overflow-x-auto bg-white rounded-lg border border-slate-200">
					<table className="w-full text-sm text-left">
						<caption className="sr-only">Site admin accounts</caption>
						<thead className="bg-slate-100 text-slate-700">
							<tr>
								<th scope="col" className="px-4 py-3">Username</th>
								<th scope="col" className="px-4 py-3">Email</th>
								<th scope="col" className="px-4 py-3">MFA</th>
								<th scope="col" className="px-4 py-3">Added</th>
								<th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{admins.map((a) => {
								const isMe = a.id === myId;
								return (
									<tr key={a.id} className="border-t border-slate-200">
										<td className="px-4 py-3">{a.username}{isMe && <span className="ml-2 text-xs font-semibold text-slate-600">(you)</span>}</td>
										<td className="px-4 py-3">{a.email}</td>
										<td className="px-4 py-3">{a.twoFactorEnabled ? 'Enabled' : 'Not set up yet'}</td>
										<td className="px-4 py-3">{formatDate(a.createdAt)}</td>
										<td className="px-4 py-3">
											{!isMe && admins.length > 1 && (
												<Button variant="ghost" onClick={() => removeAdmin(a)} aria-label={`Remove admin ${a.email}`}>
													Remove
												</Button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			<section aria-labelledby="add-admin-heading" className="bg-white p-6 rounded-lg border border-slate-200 space-y-4 max-w-xl">
				<h2 id="add-admin-heading" className="text-lg font-bold">Add an admin</h2>
				<form onSubmit={addAdmin} className="space-y-3">
					<div>
						<label htmlFor="admin-email" className="block text-sm font-medium text-slate-700">Email</label>
						<input id="admin-email" type="email" required autoComplete="off" value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2" />
					</div>
					<div>
						<label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">First password</label>
						<input id="admin-password" type="password" required minLength={8} autoComplete="new-password" value={password}
							onChange={(e) => setPassword(e.target.value)} aria-describedby="admin-password-hint"
							className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2" />
						<p id="admin-password-hint" className="text-xs text-slate-600 mt-1">
							At least 8 characters. Give it to them yourself; they change it in Settings after signing in.
						</p>
					</div>
					<Button type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add admin'}</Button>
				</form>
			</section>
		</AdminShell>
	);
}
