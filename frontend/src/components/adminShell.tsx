'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SkipLink } from './SkipLink';
import { Footer } from './footer';
import { clearSession, getRole, getToken } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

const TABS = [
	{ href: '/admin', label: 'Overview' },
	{ href: '/admin/users', label: 'Users' },
	{ href: '/admin/trees', label: 'Trees' },
	{ href: '/admin/admins', label: 'Admins' },
	{ href: '/settings', label: 'My account' },
];

// The site admin console: its own header and tabs, none of the member app
// (no trees of their own, no friends). Only ADMIN sessions get in; with
// allowModerator (Users, and Trees read-only) moderators do too, with a link back to
// their dashboard instead of the admin tabs.
export function AdminShell({ title, allowModerator = false, children }: {
	title: string;
	allowModerator?: boolean;
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const [role, setRole] = useState<string | null>(null);

	// Read after mount: the session lives in sessionStorage.
	useEffect(() => {
		const r = getRole();
		if (!getToken()) {
			router.replace('/staff');
			return;
		}
		if (r !== 'ADMIN' && !(allowModerator && r === 'MODERATOR')) {
			router.replace('/dashboard');
			return;
		}
		setRole(r);
	}, [router, allowModerator]);

	const signOut = async () => {
		const wasAdmin = getRole() === 'ADMIN';
		clearSession();
		await supabase.auth.signOut().catch(() => {});
		router.replace(wasAdmin ? '/staff' : '/login');
	};

	const isAdmin = role === 'ADMIN';

	return (
		<div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="bg-slate-900 text-white focus:outline-none">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
					<Link href={isAdmin ? '/admin' : '/dashboard'} className="font-bold rounded focus:outline-none focus:ring-2 focus:ring-amber-400">
						My Simple Family Tree <span className="font-normal text-slate-300">· {isAdmin ? 'Admin console' : 'Moderation'}</span>
					</Link>
					<button type="button" onClick={signOut}
						className="!w-auto !bg-transparent border !border-solid !border-slate-500 hover:!bg-slate-800 !px-4 !py-1.5 text-sm">
						Sign out
					</button>
				</div>
				{role && (
					<nav aria-label="Admin console" className="max-w-6xl mx-auto px-4 sm:px-6">
						<ul className="flex flex-wrap gap-1 !pl-0 list-none">
							{(isAdmin ? TABS : [{ href: '/dashboard', label: '← Back to dashboard' }, { href: '/admin/users', label: 'Users' }, { href: '/admin/trees', label: 'Trees' }]).map((t) => {
								const current = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href);
								return (
									<li key={t.href}>
										<Link href={t.href} aria-current={current ? 'page' : undefined}
											className={`inline-block px-4 py-2 text-sm rounded-t-md focus:outline-none focus:ring-2 focus:ring-amber-400 ${current ? 'bg-slate-50 text-slate-900 font-semibold' : 'text-slate-200 hover:bg-slate-800'}`}>
											{t.label}
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>
				)}
			</header>

			<main id="main-content" tabIndex={-1} className="focus:outline-none max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
				<h1 className="text-2xl font-bold">{title}</h1>
				{role ? children : <p aria-live="polite">Loading…</p>}
			</main>

			<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
				<Footer />
			</footer>
		</div>
	);
}
