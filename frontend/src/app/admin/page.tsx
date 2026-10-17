'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/adminShell';
import { adminRequest, type AdminStats } from '@/lib/admin';
import { getRole } from '@/lib/auth';

const count = (n: number | undefined, word: string) => `${n ?? 0} ${word}${n === 1 ? '' : 's'}`;

// Admin console home: how many accounts and trees there are, and where to go.
export default function AdminOverviewPage() {
	const [stats, setStats] = useState<AdminStats | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (getRole() !== 'ADMIN') return; // the shell redirects
		adminRequest<AdminStats>('/admin/stats').then(setStats).catch((e) => setError(e.message));
	}, []);

	const cards = stats ? [
		{ label: 'Accounts', value: stats.users, href: '/admin/users',
			note: `${count(stats.roles.USER, 'user')} · ${count(stats.roles.MODERATOR, 'moderator')} · ${count(stats.roles.ADMIN, 'admin')}${stats.roles.GUEST ? ` · ${count(stats.roles.GUEST, 'guest')}` : ''}` },
		{ label: 'Suspended', value: stats.suspended, href: '/admin/users', note: 'accounts that can’t sign in' },
		{ label: 'MFA on', value: stats.mfa, href: '/admin/users', note: 'accounts with an authenticator app' },
		{ label: 'Trees', value: stats.trees, href: '/admin/trees', note: `${stats.people} ${stats.people === 1 ? 'person' : 'people'} drawn in them` },
	] : [];

	return (
		<AdminShell title="Overview">
			<p className="text-slate-700">You&apos;re signed in as a site admin. Admin accounts manage every user and tree; they don&apos;t make trees or friends.</p>
			{error && <p role="alert" className="text-red-700 font-semibold">{error}</p>}
			{!stats && !error && <p aria-live="polite">Loading…</p>}
			{stats && (
				<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 !pl-0 list-none">
					{cards.map((c) => (
						<li key={c.label}>
							<Link href={c.href} className="block h-full bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-700">
								<span className="block text-sm text-slate-600">{c.label}</span>
								<span className="block text-3xl font-bold mt-1">{c.value}</span>
								<span className="block text-sm text-slate-600 mt-2">{c.note}</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</AdminShell>
	);
}
