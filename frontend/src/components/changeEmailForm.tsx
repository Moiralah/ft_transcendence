'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Account =
	| { kind: 'loading' }
	| { kind: 'no-session' }
	| { kind: 'google-only' }
	| { kind: 'ready'; email: string; pendingEmail?: string };

export function ChangeEmailForm() {
	const [account, setAccount] = useState<Account>({ kind: 'loading' });
	const [newEmail, setNewEmail] = useState('');
	const [currentPassword, setCurrentPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		supabase.auth.getUser().then(({ data }) => {
			const user = data.user;
			if (!user?.email) {
				setAccount({ kind: 'no-session' });
			} else if (!user.identities?.some((i) => i.provider === 'email')) {
				// Google-only account: the email belongs to Google, and the next
				// Google login would just overwrite a change made here.
				setAccount({ kind: 'google-only' });
			} else {
				setAccount({ kind: 'ready', email: user.email, pendingEmail: user.new_email ?? undefined });
			}
		});
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
			// Same re-check as ChangePasswordForm: someone at an unlocked browser
			// shouldn't be able to move the account to their own address.
			const { error: authError } = await supabase.auth.signInWithPassword({
				email: account.email,
				password: currentPassword,
			});
			if (authError) {
				setError('Current password is incorrect');
				return;
			}
			// Nothing changes yet: Supabase emails a link to the new address and
			// the switch happens once it's clicked. Production has "Secure email
			// change" off (2026-10-04), so the old address isn't asked: the
			// current password above plus the new inbox are the checks. The
			// backend picks up the new address on the next login (matches by id).
			const { error: updateError } = await supabase.auth.updateUser(
				{ email },
				{ emailRedirectTo: `${window.location.origin}/login` },
			);
			if (updateError) {
				setError(updateError.message);
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
					You signed in with Google, so your email is managed by your Google account.
				</p>
			)}

			{account.kind === 'ready' && (
				<form onSubmit={handleSubmit} className="space-y-2">
					<p className="text-sm text-slate-700">
						Current email: <strong>{account.email}</strong>
					</p>
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
