// frontend/src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import toast, { Toaster } from 'react-hot-toast';
import { useAuditLogNotifications } from '@/hooks/notifications';

type Profile = {
	id: number;
	firstName: string;
	lastName: string | null;
	gender: string | null;
	birthDate: string | null;
	deathDate: string | null;
	motherId: number | null;
	fatherId: number | null;
};

type TreeMember = {
	id: number;
	userId: string;
	user: { username: string; email: string };
	role: string;
};

type Tree = {
	id: number;
	name: string;
	code: string;
	description: string;
	ownerId: string;
	owner: { username: string };
	userRole: string;
	members: TreeMember[];
	profiles: Profile[];
};

export default function Tree() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const treeIdParam = searchParams.get('treeId');

	const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;

	const [tree, setTree] = useState<Tree | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showMembers, setShowMembers] = useState(false);

	useAuditLogNotifications(tree?.id ?? null);

	useEffect(() => {
		if (!token) {
			router.push('/login');
			return;
		}
		if (treeIdParam) {
			fetchTree(Number(treeIdParam));
		} else {
			router.push('/trees');
		}
	}, [treeIdParam]);

	const fetchTree = async (id: number) => {
		try {
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/trees/${id}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error('Failed to fetch tree');
			const data = await res.json();
			setTree(data);
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const canEdit = (role: string) => ['ADMIN', 'MODERATOR', 'MEMBER'].includes(role);
	const canManageMembers = (role: string) => ['ADMIN', 'MODERATOR'].includes(role);

	if (loading) return <div className="p-8">Loading tree...</div>;
	if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
	if (!tree) return <div className="p-8">Tree not found. <Link href="/trees" className="text-amber-500">Go back</Link></div>;

	return (
		<div className="min-h-screen bg-gray-50 flex flex-col">
			{/* Add Toaster for notifications */}
			<Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
			{/* Header */}
			<header className="bg-white shadow-sm p-4 border-b">
				<div className="max-w-6xl mx-auto flex justify-between items-center">
					<div>
						<h1 className="text-2xl font-bold">{tree.name}</h1>
						<p className="text-sm text-gray-500">Code: {tree.code} • Role: <span className="font-medium text-amber-600">{tree.userRole}</span></p>
					</div>
					<div className="flex gap-2">
						<Link href="/trees" className="text-gray-600 hover:text-gray-800">← All Trees</Link>
						<button
							onClick={() => router.push('/login')}
							className="text-red-500 hover:text-red-700"
						>
							Logout
						</button>
					</div>
				</div>
			</header>

			<div className="flex-1 max-w-6xl mx-auto w-full p-4">
				{/* Members Section */}
				<div className="bg-white rounded-lg shadow p-4 mb-4">
					<button
						onClick={() => setShowMembers(!showMembers)}
						className="text-left w-full flex justify-between items-center"
					>
						<h2 className="text-lg font-semibold">Members ({tree.members.length})</h2>
						<span>{showMembers ? '▼' : '▶'}</span>
					</button>
					{showMembers && (
						<div className="mt-2 space-y-2">
							{tree.members.map((m) => (
								<div key={m.id} className="flex justify-between items-center border-b pb-2">
									<div>
										<span className="font-medium">{m.user.username}</span>
										<span className="text-sm text-gray-500 ml-2">({m.user.email})</span>
									</div>
									<div className="flex items-center gap-2">
										<span className={`text-xs px-2 py-1 rounded-full ${m.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' :
												m.role === 'MODERATOR' ? 'bg-blue-100 text-blue-700' :
													m.role === 'MEMBER' ? 'bg-green-100 text-green-700' :
														'bg-gray-100 text-gray-700'
											}`}>
											{m.role}
										</span>
										{canManageMembers(tree.userRole) && m.userId !== tree.ownerId && (
											<select
												value={m.role}
												onChange={async (e) => {
													try {
														await fetch(
															`${process.env.NEXT_PUBLIC_API_URL}/trees/${tree.id}/role/${m.userId}`,
															{
																method: 'PUT',
																headers: {
																	'Content-Type': 'application/json',
																	Authorization: `Bearer ${token}`,
																},
																body: JSON.stringify({ role: e.target.value }),
															}
														);
														fetchTree(tree.id);
													} catch (err) {
														alert('Failed to update role');
													}
												}}
												className="text-xs border rounded px-1 py-0.5"
											>
												<option value="ADMIN">Admin</option>
												<option value="MODERATOR">Moderator</option>
												<option value="MEMBER">Member</option>
												<option value="VIEWER">Viewer</option>
											</select>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Profiles List */}
				<div className="bg-white rounded-lg shadow p-4">
					<h2 className="text-lg font-semibold mb-3">Profiles ({tree.profiles.length})</h2>
					{tree.profiles.length === 0 ? (
						<p className="text-gray-500">No profiles yet. Add your first family member!</p>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
							{tree.profiles.map((p) => (
								<div key={p.id} className="border rounded-lg p-3 hover:shadow transition">
									<div className="font-semibold">
										{p.firstName} {p.lastName}
									</div>
									<div className="text-sm text-gray-500">
										{p.birthDate ? format(parseISO(p.birthDate), 'dd MMM yyyy') : '?'}
										{p.deathDate && ` – †${format(parseISO(p.deathDate), 'dd MMM yyyy')}`}
									</div>
									<div className="text-xs text-gray-400 mt-1">
										{p.motherId ? 'Has mother' : ''}
										{p.fatherId ? ' • Has father' : ''}
									</div>
									{canEdit(tree.userRole) && (
										<button className="mt-2 text-xs text-blue-500 hover:text-blue-700">
											Edit
										</button>
									)}
								</div>
							))}
						</div>
					)}
				</div>

				{/* Quick Actions */}
				<div className="mt-4 flex gap-2">
					{canEdit(tree.userRole) && (
						<button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm">
							+ Add Profile
						</button>
					)}
					<button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
						📊 View Tree
					</button>
				</div>
			</div>
		</div>
	);
}
