'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { clearSession, MIN_PASSWORD_LENGTH } from '@/lib/auth';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

// A session created by the emailed link carries an `otp` entry in its `amr`
// (authentication methods) claim; a normal password or OAuth login doesn't.
// Used so this page only offers the "no current password needed" form to
// someone who actually arrived from the reset email.
function isRecoverySession(session: Session | null): boolean {
	if (!session) return false;
	try {
		const payload = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
		return Array.isArray(payload.amr) && payload.amr.some((a: { method: string }) => a.method === 'otp' || a.method === 'recovery');
	} catch {
		return false;
	}
}

export default function ResetPasswordPage() {
	const router = useRouter();
	const [state, setState] = useState<'checking' | 'ready' | 'invalid'>('checking');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		let active = true;
		// supabase-js reads the recovery session out of the URL when it starts,
		// which can be before this effect subscribes, so the PASSWORD_RECOVERY
		// event alone can be missed — also inspect the session directly.
		const { data: sub } = supabase.auth.onAuthStateChange((event) => {
			if (event === 'PASSWORD_RECOVERY' && active) setState('ready');
		});
		supabase.auth.getSession().then(({ data }) => {
			if (!active) return;
			setState((current) => (current === 'ready' || isRecoverySession(data.session) ? 'ready' : 'invalid'));
		});
		return () => {
			active = false;
			sub.subscription.unsubscribe();
		};
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (password !== confirmPassword) {
			setError('Passwords do not match');
			return;
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
			return;
		}
		setSubmitting(true);
		const { error } = await supabase.auth.updateUser({ password });
		if (error) {
			setError(error.message);
			setSubmitting(false);
			return;
		}
		// The reset link only proves email ownership; it must not leave the
		// browser signed in. End every Supabase session for this account and
		// make them log in with the new password (and 2FA, if enabled).
		clearSession();
		await supabase.auth.signOut({ scope: 'global' });
		router.push('/login?reset=1');
	};

	return (
		<div className="flex flex-col min-h-screen text-slate-800 font-sans">
			<SkipLink />
			<header>
				<Navbar />
			</header>
			<main id="main-content" tabIndex={-1} className="flex flex-1 focus:outline-none">
				<div className="card">
					<h1>Choose a new password</h1>
					<hr />
					{state === 'checking' && <p aria-live="polite">Checking your link...</p>}
					{state === 'invalid' && (
						<>
							<div className="error" role="alert">
								This reset link is invalid or has expired.
							</div>
							<p className="text-sm mt-3">
								<Link href="/forgot-password" className="underline">Request a new link</Link>
							</p>
						</>
					)}
					{state === 'ready' && (
						<form onSubmit={handleSubmit} className="mb-3">
							<label htmlFor="new-password" className="sr-only">New password</label>
							<input
								id="new-password"
								type="password"
								autoComplete="new-password"
								placeholder={`New password (min. ${MIN_PASSWORD_LENGTH} characters)`}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
							<label htmlFor="confirm-new-password" className="sr-only">Confirm new password</label>
							<input
								id="confirm-new-password"
								type="password"
								autoComplete="new-password"
								placeholder="Confirm new password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
							/>
							<button type="submit" disabled={submitting}>
								{submitting ? 'Saving...' : 'Set new password'}
							</button>
							{error && <div className="error" role="alert">{error}</div>}
						</form>
					)}
				</div>
			</main>
			<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
				<Footer />
			</footer>
		</div>
	);
}
