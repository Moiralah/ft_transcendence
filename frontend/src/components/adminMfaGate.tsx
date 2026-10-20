'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_MFA_SETUP_PATH, clearSession, getToken } from '@/lib/auth';

// Site admins and moderators must have MFA; the backend refuses their console
// until it's on. This sends one without it to Settings before the console
// loads, instead of showing a page of refused requests. It fails closed: the
// console is drawn only once the server has said MFA is on.
export function AdminMfaGate({ signInPath = '/staff', children }: { signInPath?: string; children: React.ReactNode }) {
	const router = useRouter();
	const [state, setState] = useState<'checking' | 'ready' | 'error'>('checking');
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		const token = getToken();
		// No session: straight to sign-in, without drawing any of the console
		// first (the session is per-tab, so a pasted link in a new browser or
		// tab lands here).
		if (!token) {
			router.replace(signInPath);
			return;
		}
		setState('checking');
		fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/2fa/status`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async (res) => {
				// Session ended (logged out, suspended, removed): sign in again.
				if (res.status === 401) {
					clearSession();
					router.replace(signInPath);
					return;
				}
				const data = res.ok ? await res.json() : null;
				if (data?.enabled === true) setState('ready');
				else if (data?.enabled === false) router.replace(ADMIN_MFA_SETUP_PATH);
				else setState('error');
			})
			.catch(() => setState('error'));
	}, [router, signInPath, attempt]);

	if (state === 'ready') return <>{children}</>;
	if (state === 'error') {
		return (
			<main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
				<div role="alert" className="max-w-md bg-white rounded-lg border border-slate-200 p-6 space-y-4 text-center">
					<p className="font-semibold text-slate-900">Couldn&apos;t check your account&apos;s MFA, so the console stays closed.</p>
					<button type="button" onClick={() => setAttempt((n) => n + 1)} className="!w-auto !px-5">Try again</button>
				</div>
			</main>
		);
	}
	return null;
}
