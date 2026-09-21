'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

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
			<header>
				<Navbar />
			</header>
			<main id="main-content" tabIndex={-1} className="flex flex-1 focus:outline-none">
				<div className="card">
					<h1>Forgot password</h1>
					<hr />
					{sent ? (
						<p className="success" role="status">
							If an account exists for that email, we&apos;ve sent a link to reset the password.
							The link works for a limited time.
						</p>
					) : (
						<form onSubmit={handleSubmit} className="mb-3">
							<p className="text-sm text-slate-700">
								Enter your account email and we&apos;ll send you a link to choose a new password.
							</p>
							<label htmlFor="forgot-email" className="sr-only">Email</label>
							<input
								id="forgot-email"
								type="email"
								autoComplete="email"
								placeholder="Email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
							<button type="submit" disabled={submitting}>
								{submitting ? 'Sending...' : 'Send reset link'}
							</button>
							{error && <div className="error" role="alert">{error}</div>}
						</form>
					)}
					<p className="text-sm mt-3">
						<Link href="/login" className="underline">Back to login</Link>
					</p>
				</div>
			</main>
			<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
				<Footer />
			</footer>
		</div>
	);
}
