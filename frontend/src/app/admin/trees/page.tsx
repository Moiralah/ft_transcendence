'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AdminShell, useConsoleBase } from '@/components/adminShell';
import { adminRequest, formatDate, type AdminTreeSummary } from '@/lib/admin';
import { getRole } from '@/lib/auth';

// Also served at /moderator/trees: moderators see every tree too, read-only
// (no Delete); the backend agrees.
const canRead = (r: string | null) => r === 'ADMIN' || r === 'MODERATOR';

// Every tree on the site, with its owner and size. Open one to see who and
// what is in it, or delete it.
export default function AdminTreesPage() {
	const [trees, setTrees] = useState<AdminTreeSummary[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [isAdmin, setIsAdmin] = useState(false);
	const base = useConsoleBase();

	useEffect(() => {
		setIsAdmin(getRole() === 'ADMIN');
		if (!canRead(getRole())) return; // the shell redirects
		adminRequest<AdminTreeSummary[]>('/admin/trees').then(setTrees).catch((e) => setError(e.message));
	}, []);

	const shown = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!trees || !q) return trees ?? [];
		return trees.filter((t) => [t.name, t.owner.name, t.owner.username, t.owner.email].some((v) => v?.toLowerCase().includes(q)));
	}, [trees, query]);

	const deleteTree = async (t: AdminTreeSummary) => {
		if (!confirm(`Delete the tree "${t.name}" and its ${t.people} people? Its ${t.accounts} member account(s) stay, but lose the tree. This cannot be undone.`)) return;
		try {
			await adminRequest(`/admin/trees/${t.id}`, { method: 'DELETE' });
			setTrees((prev) => prev?.filter((x) => x.id !== t.id) ?? null);
			toast.success(`"${t.name}" deleted.`);
		} catch (e: any) {
			toast.error(e.message);
		}
	};

	return (
		<AdminShell title="Trees">
			{error && <p role="alert" className="text-red-700 font-semibold">{error}</p>}
			{!trees && !error && <p aria-live="polite">Loading trees…</p>}
			{trees && (
				<>
					<div className="flex flex-wrap items-end gap-4 justify-between">
						<div className="w-full sm:w-80">
							<label htmlFor="tree-search" className="block text-sm font-medium text-slate-700">Search by tree or owner</label>
							<input id="tree-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="!mb-0 bg-white" />
						</div>
						<p className="text-sm text-slate-600" aria-live="polite">{shown.length} of {trees.length} trees</p>
					</div>
					<div className="relative overflow-x-auto bg-white rounded-lg border border-slate-200">
						<table className="w-full text-sm text-left">
							<caption className="sr-only">All trees on the site</caption>
							<thead className="bg-slate-100 text-slate-700">
								<tr>
									<th scope="col" className="px-4 py-3">Tree</th>
									<th scope="col" className="px-4 py-3">Owner</th>
									<th scope="col" className="px-4 py-3">People</th>
									<th scope="col" className="px-4 py-3">Member accounts</th>
									<th scope="col" className="px-4 py-3">Created</th>
									<th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
								</tr>
							</thead>
							<tbody>
								{shown.map((t) => (
									<tr key={t.id} className="border-t border-slate-200">
										<td className="px-4 py-3 font-medium break-words max-w-xs">{t.name}{t.isPublic && <span className="ml-2 text-xs text-slate-600">(public)</span>}</td>
										<td className="px-4 py-3 break-words max-w-xs">{t.owner.name}{t.owner.username && <span className="block text-xs text-slate-600">@{t.owner.username}</span>}</td>
										<td className="px-4 py-3">{t.people}</td>
										<td className="px-4 py-3">{t.accounts}</td>
										<td className="px-4 py-3 whitespace-nowrap">{formatDate(t.createdAt)}</td>
										<td className="px-4 py-3">
											<div className="flex gap-3 whitespace-nowrap">
												<Link href={`${base}/trees/${t.id}`} className="underline font-medium" aria-label={`View tree ${t.name}`}>View</Link>
												{isAdmin && (
													<button type="button" onClick={() => deleteTree(t)} aria-label={`Delete tree ${t.name}`}
														className="!w-auto !p-0 !bg-transparent !text-red-700 underline font-medium">Delete</button>
												)}
											</div>
										</td>
									</tr>
								))}
								{shown.length === 0 && (
									<tr><td colSpan={6} className="px-4 py-6 text-center text-slate-600">No trees match.</td></tr>
								)}
							</tbody>
						</table>
					</div>
				</>
			)}
		</AdminShell>
	);
}
