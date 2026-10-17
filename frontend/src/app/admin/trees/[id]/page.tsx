'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AdminShell } from '@/components/adminShell';
import { adminRequest, formatDate, type AdminTreeDetail } from '@/lib/admin';
import { getRole } from '@/lib/auth';

const CLAIM: Record<string, string> = { EMPTY: '—', PENDING: 'Claim pending', ACCEPTED: 'Claimed', DECLINED: 'Claim declined', BLOCKED: 'Blocked' };

// One tree, read-only: the people drawn in it and the accounts that belong to
// it. Admins don't edit family trees; they can delete a tree from here.
export default function AdminTreePage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const [tree, setTree] = useState<AdminTreeDetail | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (getRole() !== 'ADMIN') return; // the shell redirects
		adminRequest<AdminTreeDetail>(`/admin/trees/${encodeURIComponent(id)}`).then(setTree).catch((e) => setError(e.message));
	}, [id]);

	const deleteTree = async () => {
		if (!tree) return;
		if (!confirm(`Delete the tree "${tree.name}" and its ${tree.people.length} people? This cannot be undone.`)) return;
		try {
			await adminRequest(`/admin/trees/${tree.id}`, { method: 'DELETE' });
			toast.success(`"${tree.name}" deleted.`);
			router.replace('/admin/trees');
		} catch (e: any) {
			toast.error(e.message);
		}
	};

	return (
		<AdminShell title={tree ? tree.name : 'Tree'}>
			<p><Link href="/admin/trees" className="underline">&larr; All trees</Link></p>
			{error && <p role="alert" className="text-red-700 font-semibold">{error}</p>}
			{!tree && !error && <p aria-live="polite">Loading…</p>}
			{tree && (
				<>
					<dl className="grid gap-x-8 gap-y-2 sm:grid-cols-[max-content_1fr] bg-white rounded-lg border border-slate-200 p-5 text-sm">
						<dt className="font-semibold">Owner</dt>
						<dd>{tree.owner.name}{tree.owner.username && ` (@${tree.owner.username})`}{tree.owner.email && <span className="text-slate-600"> · {tree.owner.email}</span>}</dd>
						<dt className="font-semibold">Description</dt><dd>{tree.description || '—'}</dd>
						<dt className="font-semibold">Visibility</dt><dd>{tree.isPublic ? 'Public' : 'Private (join code)'}</dd>
						<dt className="font-semibold">Created</dt><dd>{formatDate(tree.createdAt)}</dd>
						<dt className="font-semibold">Last changed</dt><dd>{formatDate(tree.updatedAt)}</dd>
					</dl>

					<section aria-labelledby="accounts-h" className="space-y-3">
						<h2 id="accounts-h" className="text-lg font-bold">Member accounts ({tree.accounts.length})</h2>
						<div className="relative overflow-x-auto bg-white rounded-lg border border-slate-200">
							<table className="w-full text-sm text-left">
								<thead className="bg-slate-100 text-slate-700">
									<tr>
										<th scope="col" className="px-4 py-3">Name</th>
										<th scope="col" className="px-4 py-3">Username</th>
										<th scope="col" className="px-4 py-3">Email</th>
										<th scope="col" className="px-4 py-3">Tree role</th>
										<th scope="col" className="px-4 py-3">Joined</th>
									</tr>
								</thead>
								<tbody>
									{tree.accounts.map((a) => (
										<tr key={a.id} className="border-t border-slate-200">
											<td className="px-4 py-3">{a.name}</td>
											<td className="px-4 py-3">{a.username ?? '—'}</td>
											<td className="px-4 py-3 break-all">{a.email ?? '—'}</td>
											<td className="px-4 py-3">{a.treeRole}</td>
											<td className="px-4 py-3 whitespace-nowrap">{formatDate(a.joinedAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section aria-labelledby="people-h" className="space-y-3">
						<h2 id="people-h" className="text-lg font-bold">People in the tree ({tree.people.length})</h2>
						<div className="relative overflow-x-auto bg-white rounded-lg border border-slate-200">
							<table className="w-full text-sm text-left">
								<thead className="bg-slate-100 text-slate-700">
									<tr>
										<th scope="col" className="px-4 py-3">Name</th>
										<th scope="col" className="px-4 py-3">Born</th>
										<th scope="col" className="px-4 py-3">Father</th>
										<th scope="col" className="px-4 py-3">Mother</th>
										<th scope="col" className="px-4 py-3">Spouse</th>
										<th scope="col" className="px-4 py-3">Claimed by</th>
									</tr>
								</thead>
								<tbody>
									{tree.people.map((p) => (
										<tr key={p.id} className="border-t border-slate-200">
											<td className="px-4 py-3 font-medium">{p.name}</td>
											<td className="px-4 py-3">{p.birthYear ?? '—'}</td>
											<td className="px-4 py-3">{p.father ?? '—'}</td>
											<td className="px-4 py-3">{p.mother ?? '—'}</td>
											<td className="px-4 py-3">{p.spouse ?? '—'}</td>
											<td className="px-4 py-3">{p.claimedBy ? `@${p.claimedBy}${p.claim === 'PENDING' ? ' (pending)' : ''}` : CLAIM[p.claim] ?? p.claim}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section aria-labelledby="danger-h" className="bg-white rounded-lg border border-red-200 p-5 space-y-2">
						<h2 id="danger-h" className="text-lg font-bold text-red-800">Delete this tree</h2>
						<p className="text-sm text-slate-700">Removes the tree and the people drawn in it. Member accounts stay; they just lose this tree.</p>
						<button type="button" onClick={deleteTree} className="!w-auto !bg-red-700 hover:!bg-red-800 !px-5">Delete tree</button>
					</section>
				</>
			)}
		</AdminShell>
	);
}
