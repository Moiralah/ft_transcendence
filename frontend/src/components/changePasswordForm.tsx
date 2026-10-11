'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MIN_PASSWORD_LENGTH, SessionExpiredError, changePassword, getAccount, sendSetPasswordEmail } from '@/lib/auth';

type Account =
	| { kind: 'loading' }
	| { kind: 'no-session' }
	| { kind: 'no-password'; email: string }
	| { kind: 'ready'; email: string };

export function ChangePasswordForm() {
	const [account, setAccount] = useState<Account>({ kind: 'loading' });
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [linkSent, setLinkSent] = useState(false);

	const handleSetPassword = async () => {
		if (account.kind !== 'no-password') return;
		setError(null);
		setSubmitting(true);
		try {
			await sendSetPasswordEmail(account.email);
			setLinkSent(true);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSubmitting(false);
		}
	};

	useEffect(() => {
		getAccount()
			.then((info) => {
				if (!info.email) setAccount({ kind: 'no-session' });
				// Signed up through Google only: there is no password to change.
				else if (!info.hasPassword) setAccount({ kind: 'no-password', email: info.email });
				else setAccount({ kind: 'ready', email: info.email });
			})
			.catch(() => setAccount({ kind: 'no-session' }));
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
			// The backend checks the current password itself before changing
			// anything, then ends the account's other Supabase sessions.
			try {
				await changePassword(currentPassword, newPassword);
			} catch (err) {
				if (err instanceof SessionExpiredError) setAccount({ kind: 'no-session' });
				else setError((err as Error).message);
				return;
			}
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
				<div className="space-y-2">
					<p className="text-sm text-slate-700">
						You signed in with Google, so this account has no password yet. You can add one: we&apos;ll
						email a link to <strong>{account.email}</strong>. After that you can also sign in with email
						and password, and change your email below.
					</p>
					{linkSent ? (
						<div className="success" role="status">
							Check your inbox at {account.email} and follow the link to choose a password. You&apos;ll be
							asked to log in again afterwards.
						</div>
					) : (
						<button type="button" onClick={handleSetPassword} disabled={submitting}>
							{submitting ? 'Sending...' : 'Set a password'}
						</button>
					)}
					{error && <div className="error" role="alert">{error}</div>}
				</div>
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
