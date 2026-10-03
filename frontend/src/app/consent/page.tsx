'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { exchangeSupabaseToken, isTwoFactorRequired, storeSession } from '@/lib/auth';
import { TwoFactorPrompt } from '@/components/twoFactorPrompt';

export default function AuthCallback() {
	const router = useRouter();
	const [challengeToken, setChallengeToken] = useState<string | null>(null);

	useEffect(() => {
		const handleCallback = async () => {
			const { data, error } = await supabase.auth.getSession();
			if (error) {
				console.error(error);
				router.push('/login?error=SessionError');
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
					router.push('/dashboard');
				} catch {
					router.push('/login?error=BackendError');
				}
			}
		};
		handleCallback();
	}, [router]);

	if (challengeToken) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-6">
				<div className="card">
					<h1>Verify it's you</h1>
					<TwoFactorPrompt
						challengeToken={challengeToken}
						onVerified={() => router.push('/dashboard')}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center min-h-screen p-6">
			<div className="card flex flex-col items-center gap-4 text-center">
				<div
					className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"
					aria-hidden="true"
				/>
				<p className="text-slate-600" aria-live="polite">Signing you in…</p>
			</div>
		</div>
	);
}
