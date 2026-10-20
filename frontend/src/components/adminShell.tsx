'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SkipLink } from './SkipLink';
import { Footer } from './footer';
import { getRole, getToken, logOut } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

const TABS = [
	{ href: '/admin', label: 'Overview' },
	{ href: '/admin/users', label: 'Users' },
	{ href: '/admin/trees', label: 'Trees' },
	{ href: '/admin/admins', label: 'Admins' },
	{ href: '/settings', label: 'My account' },
];

const MODERATOR_TABS = [
	{ href: '/dashboard', label: '← Back to dashboard' },
	{ href: '/moderator/users', label: 'Users' },
	{ href: '/moderator/trees', label: 'Trees' },
];

// Which console a page is in: /admin (ADMIN only) or /moderator (MODERATOR
// only). The Users and Trees pages are shared, so they build their links
// from this instead of hard-coding /admin.
export function useConsoleBase(): '/admin' | '/moderator' {
	return usePathname().startsWith('/moderator') ? '/moderator' : '/admin';
}

// The site admin console and the moderation console: their own header and
// tabs, none of the member app (no trees of their own, no friends). /admin
// lets in ADMIN sessions only, /moderator MODERATOR sessions only (Users,
// and Trees read-only), with a link back to their dashboard. Each role that
// lands in the other's console is sent to its own.
export function AdminShell({ title, children }: {
	title: string;
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const base = useConsoleBase();
	const [role, setRole] = useState<string | null>(null);

	// Read after mount: the session lives in sessionStorage.
	useEffect(() => {
		const r = getRole();
		if (!getToken()) {
			router.replace(base === '/admin' ? '/staff' : '/login');
			return;
		}
		const wanted = base === '/admin' ? 'ADMIN' : 'MODERATOR';
		if (r !== wanted) {
			// The same page in the right console when there is one (an old
			// /admin/users bookmark), else that role's home.
			const other = r === 'ADMIN' ? '/admin' : r === 'MODERATOR' ? '/moderator' : null;
			const rest = pathname.slice(base.length);
			const shared = /^\/(users|trees)(\/|$)/.test(rest);
			router.replace(other === '/admin' ? (shared ? other + rest : '/admin')
				: other === '/moderator' && shared ? other + rest : '/dashboard');
			return;
		}
		setRole(r);
	}, [router, base, pathname]);

	const signOut = async () => {
		const path = await logOut();
		await supabase.auth.signOut().catch(() => {});
		router.replace(path);
	};

	const isAdmin = role === 'ADMIN';

	// Nothing of the console (header, title, tabs) until the role is checked,
	// so someone who isn't let in never sees it flash before the redirect.
	if (!role) {
		return (
			<div className="min-h-screen bg-slate-50">
				<p aria-live="polite" className="sr-only">Loading…</p>
			</div>
		);
	}

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
				<nav aria-label={isAdmin ? 'Admin console' : 'Moderation'} className="max-w-6xl mx-auto px-4 sm:px-6">
					<ul className="flex flex-wrap gap-1 !pl-0 list-none">
						{(isAdmin ? TABS : MODERATOR_TABS).map((t) => {
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
			</header>

			<main id="main-content" tabIndex={-1} className="focus:outline-none max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
				<h1 className="text-2xl font-bold">{title}</h1>
				{children}
			</main>

			<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
				<Footer />
			</footer>
		</div>
	);
}
