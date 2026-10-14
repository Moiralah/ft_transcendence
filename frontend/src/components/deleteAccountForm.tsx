'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SessionExpiredError, clearSession, deleteAccount, getAccount } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

type Account =
	| { kind: 'loading' }
	| { kind: 'no-session' }
	| { kind: 'ready'; hasPassword: boolean }
	| { kind: 'deleted' };

export function DeleteAccountForm() {
	const router = useRouter();
	const [account, setAccount] = useState<Account>({ kind: 'loading' });
	const [open, setOpen] = useState(false);
	const [currentPassword, setCurrentPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		getAccount()
			.then((info) => setAccount(info.email ? { kind: 'ready', hasPassword: info.hasPassword } : { kind: 'no-session' }))
			.catch(() => setAccount({ kind: 'no-session' }));
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (account.kind !== 'ready') return;
		setError(null);
		if (confirm !== 'DELETE') {
			setError('Type DELETE in capitals to confirm');
			return;
		}
		setSubmitting(true);
		try {
			await deleteAccount(currentPassword, confirm);
		} catch (err) {
			if (err instanceof SessionExpiredError) setAccount({ kind: 'no-session' });
			else setError((err as Error).message);
			setSubmitting(false);
			return;
		}
		clearSession();
		// OAuth logins also leave a Supabase session in the browser; drop it too.
		try {
			await supabase.auth.signOut();
		} catch {
			// the account is gone either way
		}
		setAccount({ kind: 'deleted' });
		setTimeout(() => router.push('/'), 3000);
	};

	return (
		<section aria-labelledby="delete-account-heading" className="bg-white p-6 rounded-lg border border-red-300 space-y-4">
			<h2 id="delete-account-heading" className="text-lg font-bold text-red-700">
				Delete account
			</h2>

			{account.kind === 'loading' && <p aria-live="polite" className="text-sm text-slate-700">Loading...</p>}

			{account.kind === 'no-session' && (
				<p className="text-sm text-slate-700">
					Your sign-in session has expired. <Link href="/login" className="underline">Log in again</Link> to
					delete your account.
				</p>
			)}

			{account.kind === 'deleted' && (
				<div className="success" role="status">
					Your account was deleted. Taking you to the home page...
				</div>
			)}

			{account.kind === 'ready' && (
				<div className="space-y-2">
					<p className="text-sm text-slate-700">
						This can&apos;t be undone. Your login, profile, photos and friends are removed. <strong>Family
						trees you own are deleted for everyone in them.</strong> You leave the trees you joined, and a
						person you claimed there goes back to how it was before.
					</p>
					{!open ? (
						<button type="button" onClick={() => setOpen(true)} className="bg-red-700 hover:bg-red-800">
							Delete my account
						</button>
					) : (
						<form onSubmit={handleSubmit} className="space-y-2">
							{account.hasPassword && (
								<>
									<label htmlFor="delete-current-password" className="block text-sm font-medium text-slate-800">
										Current password
									</label>
									<input
										id="delete-current-password"
										type="password"
										autoComplete="current-password"
										value={currentPassword}
										onChange={(e) => setCurrentPassword(e.target.value)}
										required
									/>
								</>
							)}
							<label htmlFor="delete-confirm" className="block text-sm font-medium text-slate-800">
								Type <strong>DELETE</strong> to confirm
							</label>
							<input
								id="delete-confirm"
								type="text"
								autoComplete="off"
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
								required
							/>
							<div className="flex gap-2">
								<button type="submit" disabled={submitting} className="bg-red-700 hover:bg-red-800">
									{submitting ? 'Deleting...' : 'Delete my account forever'}
								</button>
								<button
									type="button"
									disabled={submitting}
									onClick={() => { setOpen(false); setCurrentPassword(''); setConfirm(''); setError(null); }}
									className="bg-slate-200 text-slate-900 hover:bg-slate-300"
								>
									Cancel
								</button>
							</div>
							{error && <div className="error" role="alert">{error}</div>}
						</form>
					)}
				</div>
			)}
		</section>
	);
}
