'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { exchangeSupabaseToken, homeFor, isApiUnreachable, isSuspended, isTwoFactorRequired, isWrongPortal, portalPath, storeSession, takePortal, wrongPortalPath } from '@/lib/auth';
import { TwoFactorPrompt } from '@/components/twoFactorPrompt';
import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export default function AuthCallback() {
	const router = useRouter();
	const [challengeToken, setChallengeToken] = useState<string | null>(null);
	// Dev (React Strict Mode) runs effects twice; two logins at once for a new
	// Google user race each other and the second fails. Run it once.
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		// Which page the Google sign-in started from: /login or /staff.
		const portal = takePortal();
		const back = portalPath(portal);
		const handleCallback = async () => {
			const { data, error } = await supabase.auth.getSession();
			// No session at all (cancelled at Google, or the browser couldn't
			// reach Supabase, e.g. Safari blocking local http Supabase from the
			// https site): say so instead of spinning forever.
			if (error || !data.session) {
				if (error) console.error(error);
				router.replace(`${back}?error=SessionError`);
				return;
			}
			try {
				const result = await exchangeSupabaseToken(data.session.access_token, portal);
				if (isTwoFactorRequired(result)) {
					setChallengeToken(result.challengeToken);
					return;
				}
				storeSession(result);
				router.replace(homeFor(result.user.role));
			} catch (err) {
				// Say why on the login page instead of a generic "BackendError".
				router.replace(isSuspended(err) ? `${back}?error=suspended`
					: isWrongPortal(err) ? wrongPortalPath(portal)
					: isApiUnreachable(err) ? `${back}?error=ApiUnreachable`
					: `${back}?error=BackendError`);
			}
		};
		handleCallback();
	}, [router]);

	return (
		<div className="flex flex-col min-h-screen text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar />
			</header>
			<main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center p-6 focus:outline-none">
				<div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-lg p-8 flex flex-col items-center gap-4 text-center">
					{challengeToken ? (
						<>
							<h1 className="text-xl font-bold text-slate-900">Verify it&apos;s you</h1>
							<TwoFactorPrompt
								challengeToken={challengeToken}
								onVerified={(result) => router.replace(homeFor(result.user.role))}
							/>
						</>
					) : (
						<>
							<div
								className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-amber-700 animate-spin"
								aria-hidden="true"
							/>
							<p className="text-slate-600" aria-live="polite">Signing you in…</p>
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
