'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginAsGuest, rememberGuestTree, storeSession } from '@/lib/auth';
import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

// "Try as guest" from the front page: signs in on a new guest account of this
// visit's own and opens its copy of the demo tree.
export default function GuestLogin() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	// Dev (React Strict Mode) runs effects twice: log in once.
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		loginAsGuest()
			.then((result) => {
				storeSession(result);
				if (result.slug) rememberGuestTree(result.slug);
				router.replace(result.slug ? `/canvas/${result.slug}` : '/dashboard');
			})
			.catch((err) => setError(err instanceof Error ? err.message : 'Guest login failed.'));
	}, [router]);

	return (
		<div className="flex flex-col min-h-screen text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar />
			</header>
			<main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center p-6 focus:outline-none">
				<div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-lg p-8 flex flex-col items-center gap-4 text-center">
					{error ? (
						<>
							<h1 className="text-xl font-bold text-slate-900">Guest access didn&apos;t work</h1>
							<p role="alert" className="text-slate-600">{error}</p>
							<p className="text-slate-600">
								<Link href="/signup" className="underline">Sign up</Link> or <Link href="/login" className="underline">log in</Link> instead.
							</p>
						</>
					) : (
						<>
							<div
								className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-amber-700 animate-spin"
								aria-hidden="true"
							/>
							<p className="text-slate-600" aria-live="polite">Opening the demo tree…</p>
						</>
					)}
				</div>
			</main>
			<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
				<Footer />
			</footer>
		</div>
	);
}
