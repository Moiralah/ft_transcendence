'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth';

type Account =
	| { kind: 'loading' }
	| { kind: 'no-session' }
	| { kind: 'no-password' }
	| { kind: 'ready'; email: string };

export function ChangePasswordForm() {
	const [account, setAccount] = useState<Account>({ kind: 'loading' });
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		supabase.auth.getUser().then(({ data }) => {
			const user = data.user;
			if (!user?.email) {
				setAccount({ kind: 'no-session' });
			} else if (!user.identities?.some((i) => i.provider === 'email')) {
				// Signed up through Google/GitHub only: there is no password to change.
				setAccount({ kind: 'no-password' });
			} else {
				setAccount({ kind: 'ready', email: user.email });
			}
		});
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (account.kind !== 'ready') return;
		setError(null);
		setSuccess(false);

		if (newPassword !== confirmPassword) {
			setError('New passwords do not match');
			return;
		}
		if (newPassword.length < MIN_PASSWORD_LENGTH) {
			setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
			return;
		}
		if (newPassword === currentPassword) {
			setError('New password must be different from the current one');
			return;
		}

		setSubmitting(true);
		try {
			// Re-check the current password, so someone at an unlocked browser
			// can't change it without knowing it. (UI-level check: Supabase's own
			// updateUser doesn't ask for it.)
			const { error: authError } = await supabase.auth.signInWithPassword({
				email: account.email,
				password: currentPassword,
			});
			if (authError) {
				setError('Current password is incorrect');
				return;
			}
			const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
			if (updateError) {
				setError(updateError.message);
				return;
			}
			// Sign out every other Supabase session for this account (best effort).
			await supabase.auth.signOut({ scope: 'others' });
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
			setSuccess(true);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<section aria-labelledby="change-password-heading" className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
			<h2 id="change-password-heading" className="text-lg font-bold text-slate-900">
				Change password
			</h2>

			{account.kind === 'loading' && <p aria-live="polite" className="text-sm text-slate-700">Loading...</p>}

			{account.kind === 'no-session' && (
				<p className="text-sm text-slate-700">
					Your sign-in session has expired. <Link href="/login" className="underline">Log in again</Link> to
					change your password.
				</p>
			)}

			{account.kind === 'no-password' && (
				<p className="text-sm text-slate-700">
					You signed in with Google or GitHub, so this account has no password to change.
				</p>
			)}

			{account.kind === 'ready' && (
				<form onSubmit={handleSubmit} className="space-y-2">
					<label htmlFor="current-password" className="block text-sm font-medium text-slate-800">
						Current password
					</label>
					<input
						id="current-password"
						type="password"
						autoComplete="current-password"
						value={currentPassword}
						onChange={(e) => setCurrentPassword(e.target.value)}
						required
					/>
					<label htmlFor="change-new-password" className="block text-sm font-medium text-slate-800">
						New password (min. {MIN_PASSWORD_LENGTH} characters)
					</label>
					<input
						id="change-new-password"
						type="password"
						autoComplete="new-password"
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						required
					/>
					<label htmlFor="change-confirm-password" className="block text-sm font-medium text-slate-800">
						Confirm new password
					</label>
					<input
						id="change-confirm-password"
						type="password"
						autoComplete="new-password"
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						required
					/>
					<button type="submit" disabled={submitting}>
						{submitting ? 'Saving...' : 'Change password'}
					</button>
					{error && <div className="error" role="alert">{error}</div>}
					{success && (
						<div className="success" role="status">
							Password updated. Your other sign-in sessions on this account were ended.
						</div>
					)}
				</form>
			)}
		</section>
	);
}
