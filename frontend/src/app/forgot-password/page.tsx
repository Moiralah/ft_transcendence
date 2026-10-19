'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

import logo from '@/app/icon.png';

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
			redirectTo: `${window.location.origin}/reset-password`,
		});
		setSubmitting(false);
		// Supabase answers the same whether or not the address has an account,
		// so this page can't be used to find out who is registered. Only
		// things like rate limits come back as errors.
		if (error) setError(error.message);
		else setSent(true);
	};

	return (
		<div className="flex flex-col min-h-screen text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar />
			</header>
			<main id="main-content" tabIndex={-1} className="flex flex-1 px-4 focus:outline-none">
				{/* Same card as the login page (components/signInCard.tsx), the
				    signup page, and reset-password: identical shell and header. */}
				<div className="w-full max-w-md mx-auto mt-24 mb-12 self-start bg-white rounded-xl shadow-lg p-8 border-t-4 border-amber-700">
					<div className="flex flex-col items-center gap-2 mb-6 text-center">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={logo.src} alt="" width={56} height={56} draggable={false} className="h-14 w-14 select-none" />
						<h1 className="text-2xl font-bold text-slate-900">Forgot password</h1>
					</div>

					{sent ? (
						<div className="flex flex-col gap-4">
							<p className="success" role="status">
								If an account exists for that email, we&apos;ve sent a link to reset the password.
								The link works for a limited time.
							</p>
							<p className="text-sm text-center text-slate-700">
								<Link href="/login" className="underline">Back to login</Link>
							</p>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="flex flex-col gap-1">
							<p className="text-sm text-slate-700 mb-2">
								Enter your account email and we&apos;ll send you a link to choose a new password.
							</p>
							<label htmlFor="forgot-email" className="text-sm font-medium text-slate-700">Email</label>
							<input
								id="forgot-email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="!text-base !py-3 !mt-0"
								suppressHydrationWarning
							/>
							<button
								type="submit"
								disabled={submitting}
								className="mt-4 !py-3 !text-base font-semibold disabled:opacity-60"
							>
								{submitting ? 'Sending…' : 'Send reset link'}
							</button>
							{error && <div className="error" role="alert">{error}</div>}
							<p className="text-sm text-center text-slate-700 mt-4">
								<Link href="/login" className="underline">Back to login</Link>
							</p>
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
