'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SessionExpiredError, changeEmail, getAccount } from '@/lib/auth';

type Account =
	| { kind: 'loading' }
	| { kind: 'no-session' }
	| { kind: 'google-only' }
	| { kind: 'ready'; email: string; pendingEmail?: string; hasGoogle: boolean };

export function ChangeEmailForm() {
	const [account, setAccount] = useState<Account>({ kind: 'loading' });
	const [newEmail, setNewEmail] = useState('');
	const [currentPassword, setCurrentPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		getAccount()
			.then((info) => {
				if (!info.email) setAccount({ kind: 'no-session' });
				// Google-only account: the email belongs to Google, and the next
				// Google login would just overwrite a change made here.
				else if (!info.hasPassword) setAccount({ kind: 'google-only' });
				else setAccount({ kind: 'ready', email: info.email, pendingEmail: info.pendingEmail ?? undefined, hasGoogle: info.hasGoogle });
			})
			.catch(() => setAccount({ kind: 'no-session' }));
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (account.kind !== 'ready') return;
		setError(null);
		setSentTo(null);

		const email = newEmail.trim().toLowerCase();
		if (email === account.email.toLowerCase()) {
			setError('That is already your email address');
			return;
		}

		setSubmitting(true);
		try {
			// The backend checks the current password server-side, then has
			// Supabase email a link to the new address; the switch happens once
			// it's clicked. Production has "Secure email change" off, so the old
			// address isn't asked: the password plus the new inbox are the checks.
			try {
				await changeEmail(currentPassword, email);
			} catch (err) {
				if (err instanceof SessionExpiredError) setAccount({ kind: 'no-session' });
				else setError((err as Error).message);
				return;
			}
			setNewEmail('');
			setCurrentPassword('');
			setSentTo(email);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<section aria-labelledby="change-email-heading" className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
			<h2 id="change-email-heading" className="text-lg font-bold text-slate-900">
				Change email
			</h2>

			{account.kind === 'loading' && <p aria-live="polite" className="text-sm text-slate-700">Loading...</p>}

			{account.kind === 'no-session' && (
				<p className="text-sm text-slate-700">
					Your sign-in session has expired. <Link href="/login" className="underline">Log in again</Link> to
					change your email.
				</p>
			)}

			{account.kind === 'google-only' && (
				<p className="text-sm text-slate-700">
					You signed in with Google and haven&apos;t set a password yet. To change your email, first use
					<strong> Set a password</strong> above, then come back here.
				</p>
			)}

			{account.kind === 'ready' && (
				<form onSubmit={handleSubmit} className="space-y-2">
					<p className="text-sm text-slate-700">
						Current email: <strong>{account.email}</strong>
					</p>
					{account.hasGoogle && (
						<p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2" role="note">
							This account also signs in with Google. After changing your email, sign in with your new
							email and password; &quot;Sign in with Google&quot; may no longer open this account.
						</p>
					)}
					{account.pendingEmail && !sentTo && (
						<p className="text-sm text-slate-700" role="status">
							A change to <strong>{account.pendingEmail}</strong> is waiting for confirmation. Click the
							link we sent to {account.pendingEmail}. Until then, keep logging in with {account.email}.
						</p>
					)}
					<label htmlFor="change-new-email" className="block text-sm font-medium text-slate-800">
						New email
					</label>
					<input
						id="change-new-email"
						type="email"
						autoComplete="email"
						value={newEmail}
						onChange={(e) => setNewEmail(e.target.value)}
						required
					/>
					<label htmlFor="change-email-password" className="block text-sm font-medium text-slate-800">
						Current password
					</label>
					<input
						id="change-email-password"
						type="password"
						autoComplete="current-password"
						value={currentPassword}
						onChange={(e) => setCurrentPassword(e.target.value)}
						required
					/>
					<button type="submit" disabled={submitting}>
						{submitting ? 'Sending...' : 'Change email'}
					</button>
					{error && <div className="error" role="alert">{error}</div>}
					{sentTo && (
						<div className="success" role="status">
							We sent a confirmation link to <strong>{sentTo}</strong>. Click it to finish the change.
							Until then, keep logging in with {account.email}.
						</div>
					)}
				</form>
			)}
		</section>
	);
}
