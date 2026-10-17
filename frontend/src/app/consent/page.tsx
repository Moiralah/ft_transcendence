'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { exchangeSupabaseToken, isApiUnreachable, isSuspended, isTwoFactorRequired, storeSession } from '@/lib/auth';
import { TwoFactorPrompt } from '@/components/twoFactorPrompt';
import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export default function AuthCallback() {
	const router = useRouter();
	const [challengeToken, setChallengeToken] = useState<string | null>(null);

	useEffect(() => {
		const handleCallback = async () => {
			const { data, error } = await supabase.auth.getSession();
			if (error) {
				console.error(error);
				router.replace('/login?error=SessionError');
				return;
			}
			if (data.session) {
				try {
					const result = await exchangeSupabaseToken(data.session.access_token);
					if (isTwoFactorRequired(result)) {
						setChallengeToken(result.challengeToken);
						return;
					}
					storeSession(result);
					router.replace('/dashboard');
				} catch (err) {
					// Say why on the login page instead of a generic "BackendError".
					router.replace(isSuspended(err) ? '/login?error=suspended'
						: isApiUnreachable(err) ? '/login?error=ApiUnreachable'
						: '/login?error=BackendError');
				}
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
								onVerified={() => router.replace('/dashboard')}
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
