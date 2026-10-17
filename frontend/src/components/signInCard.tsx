'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
	borrowSessionFromOtherTab, exchangeSupabaseToken, getRole, getToken, homeFor, isSuspended, isTwoFactorRequired,
	loginErrorMessage, rememberPortal, storeSession, SUSPENDED_MESSAGE, type Portal,
} from '@/lib/auth';
import { TwoFactorPrompt } from './twoFactorPrompt';

// The sign-in card for both pages, laid out like the 42 intra login: logo,
// title, the form, then the small links (forgot password, the other sign-in
// page, terms). portal="member" is /login (users and moderators, email or
// Google); portal="staff" is /staff (admins, email + password only).
export function SignInCard({ portal }: { portal: Portal }) {
	const staff = portal === 'staff';
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [challengeToken, setChallengeToken] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	// The reset-password page sends people back with ?reset=1; Google sign-in
	// (/consent) and the app's pages send ?error=<code> on failures.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('reset')) setNotice('Password updated. Please sign in with your new password.');
		const message = loginErrorMessage(params.get('error'));
		if (message) setError(message);
	}, []);

	// Already signed in, in this tab or in another open tab that hands its
	// session over: no reason to show the form again.
	useEffect(() => {
		if (getToken()) {
			router.replace(homeFor(getRole()));
			return;
		}
		borrowSessionFromOtherTab().then((ok) => {
			if (ok) router.replace(homeFor(getRole()));
		});
	}, [router]);

	const handleGoogleLogin = async () => {
		rememberPortal(portal);
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${window.location.origin}/consent` },
		});
		if (error) setError(error.message);
	};

	const handleEmailLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			const { data, error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) {
				setError(error.message);
				return;
			}
			const result = await exchangeSupabaseToken(data.session.access_token, portal);
			if (isTwoFactorRequired(result)) {
				setChallengeToken(result.challengeToken);
				return;
			}
			storeSession(result);
			router.replace(homeFor(result.user.role));
		} catch (err: any) {
			setError(isSuspended(err) ? SUSPENDED_MESSAGE : err.message || 'Login failed');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className={`w-full max-w-md mx-auto mt-24 mb-12 self-start bg-white rounded-xl shadow-lg p-8 border-t-4 ${staff ? 'border-slate-800' : 'border-amber-700'}`}>
			<div className="flex flex-col items-center gap-2 mb-6 text-center">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src="/icon.png" alt="" width={56} height={56} draggable={false} className="h-14 w-14 select-none" />
				{staff && (
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-600">Staff</p>
				)}
				<h1 className="text-2xl font-bold text-slate-900">{staff ? 'Sign in as staff' : 'Sign in to your account'}</h1>
				{staff && <p className="text-sm text-slate-600">For site administrators only.</p>}
			</div>

			{challengeToken ? (
				<TwoFactorPrompt challengeToken={challengeToken} onVerified={(result) => router.replace(homeFor(result.user.role))} />
			) : (
				<>
					<form onSubmit={handleEmailLogin} className="flex flex-col gap-1">
						{/* suppressHydrationWarning: browser extensions (password managers,
						    Grammarly, etc.) inject class/style onto these after load, which
						    otherwise trips React's hydration diff on a false positive. */}
						<label htmlFor={`${portal}-email`} className="text-sm font-medium text-slate-700">Email</label>
						<input id={`${portal}-email`} type="email" autoComplete="email" required value={email}
							onChange={(e) => setEmail(e.target.value)} className="!text-base !py-3 !mt-0" suppressHydrationWarning />
						<label htmlFor={`${portal}-password`} className="text-sm font-medium text-slate-700 mt-2">Password</label>
						<input id={`${portal}-password`} type="password" autoComplete="current-password" required value={password}
							onChange={(e) => setPassword(e.target.value)} className="!text-base !py-3 !mt-0" suppressHydrationWarning />
						<button type="submit" disabled={submitting}
							className={`mt-4 !py-3 !text-base font-semibold disabled:opacity-60 ${staff ? '!bg-slate-800 hover:!bg-slate-900' : ''}`}>
							{submitting ? 'Signing in…' : 'Sign in'}
						</button>
					</form>

					{notice && <div className="success" role="status">{notice}</div>}
					{error && (
						<div className="error" role="alert">
							{error}
							{error === SUSPENDED_MESSAGE && (
								<> <Link href="/feedback" className="underline">Go to the feedback page</Link>.</>
							)}
						</div>
					)}

					{/* Staff sign in with email + password only (the backend refuses Google there). */}
					{!staff && (
						<>
							<div className="flex items-center gap-3 my-4 text-sm text-slate-600" aria-hidden="true">
								<span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" />
							</div>
							<button type="button" onClick={handleGoogleLogin}
								className="!py-3 !text-base !bg-white !text-slate-800 border !border-solid !border-slate-300 hover:!bg-slate-50">
								Sign in with Google
							</button>
						</>
					)}

					<ul className="mt-6 !pl-0 list-none flex flex-col items-center gap-2 text-sm text-slate-700">
						<li><Link href="/forgot-password" className="underline">Forgot or change your password?</Link></li>
						{staff ? (
							<li><Link href="/login" className="underline">Not staff? Go to the normal login</Link></li>
						) : (
							<>
								<li><Link href="/signup" className="underline">No account yet? Sign up</Link></li>
								<li><Link href="/staff" className="underline">Sign in as staff</Link></li>
							</>
						)}
					</ul>
				</>
			)}
		</div>
	);
}
