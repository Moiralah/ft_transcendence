'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { clearSession, endSessionsAfterReset, MIN_PASSWORD_LENGTH } from '@/lib/auth';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
// Same content-hashed import as the signup page: /icon.png is cached for a
// year, so a new logo would never show.
import logo from '@/app/icon.png';

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
		// Every app session of the account ends too, on every device. The
		// password is already changed, so a failure here is only logged.
		const { data: { session } } = await supabase.auth.getSession();
		try {
			if (session) await endSessionsAfterReset(session.access_token);
		} catch (err) {
			console.warn('Signing out the other sessions failed:', err);
		}
		clearSession();
		await supabase.auth.signOut({ scope: 'global' });
		router.replace('/login?reset=1');
	};

	return (
		<div className="flex flex-col min-h-screen text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar />
			</header>
			<main id="main-content" tabIndex={-1} className="flex flex-1 px-4 focus:outline-none">
				{/* Same card as the login page (components/signInCard.tsx) and the
				    signup page: identical shell, header block, and control styling. */}
				<div className="w-full max-w-md mx-auto mt-24 mb-12 self-start bg-white rounded-xl shadow-lg p-8 border-t-4 border-amber-700">
					<div className="flex flex-col items-center gap-2 mb-6 text-center">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={logo.src} alt="" width={56} height={56} draggable={false} className="h-14 w-14 select-none" />
						<h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
					</div>

					<div aria-live="polite">
						{state === 'checking' && (
							<p className="text-center text-slate-600">Checking your link…</p>
						)}

						{state === 'invalid' && (
							<div className="flex flex-col gap-4">
								<div className="error" role="alert">
									This reset link is invalid or has expired.
								</div>
								<p className="text-sm text-slate-700 text-center">
									<Link href="/forgot-password" className="underline">Request a new link</Link>
								</p>
							</div>
						)}
					</div>

					{state === 'ready' && (
						<form onSubmit={handleSubmit} className="flex flex-col gap-1">
							<label htmlFor="new-password" className="text-sm font-medium text-slate-700">New password</label>
							<input
								id="new-password"
								type="password"
								autoComplete="new-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="!text-base !py-3 !mt-0"
								suppressHydrationWarning
							/>
							<p className="text-xs text-slate-600">At least {MIN_PASSWORD_LENGTH} characters.</p>

							<label htmlFor="confirm-new-password" className="text-sm font-medium text-slate-700 mt-2">Confirm new password</label>
							<input
								id="confirm-new-password"
								type="password"
								autoComplete="new-password"
								required
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className="!text-base !py-3 !mt-0"
								suppressHydrationWarning
							/>

							<button
								type="submit"
								disabled={submitting}
								className="mt-4 !py-3 !text-base font-semibold disabled:opacity-60"
							>
								{submitting ? 'Saving…' : 'Set new password'}
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
