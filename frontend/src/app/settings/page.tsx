'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/button';
import { ChangePasswordForm } from '@/components/changePasswordForm';
import { ChangeEmailForm } from '@/components/changeEmailForm';
import { DeleteAccountForm } from '@/components/deleteAccountForm';
import { clearSession, getRole, getToken, homeFor, isGuest } from '@/lib/auth';

export default function SettingsPage() {
	const router = useRouter();
	const token = getToken();

	const [loading, setLoading] = useState(true);
	// Read after mount: the role lives in sessionStorage, which the server render can't see.
	const [guest, setGuest] = useState(false);
	useEffect(() => setGuest(isGuest()), []);
	// Site admins come here from the admin console, not a dashboard.
	const [siteAdmin, setSiteAdmin] = useState(false);
	useEffect(() => setSiteAdmin(getRole() === 'ADMIN'), []);
	const [enabled, setEnabled] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Enrollment (setup -> confirm) state
	const [enrolling, setEnrolling] = useState(false);
	const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
	const [secret, setSecret] = useState<string | null>(null);
	const [confirmCode, setConfirmCode] = useState('');
	const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

	// Site admins must have MFA; the backend refuses them everything else until it's on.
	const adminNeedsMfa = siteAdmin && !loading && !enabled;

	// Disable state
	const [disabling, setDisabling] = useState(false);
	const [disableCode, setDisableCode] = useState('');

	const apiUrl = process.env.NEXT_PUBLIC_API_URL;

	const authedFetch = (path: string, init?: RequestInit) =>
		fetch(`${apiUrl}${path}`, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				...(init?.headers || {}),
			},
		});

	useEffect(() => {
		if (!token) {
			router.replace('/login');
			return;
		}
		fetchStatus();
	}, [token]);

	const fetchStatus = async () => {
		try {
			const res = await authedFetch('/auth/2fa/status');
			if (!res.ok) throw new Error('Failed to load MFA status');
			const data = await res.json();
			setEnabled(data.enabled);
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const startEnrollment = async () => {
		setError(null);
		try {
			const res = await authedFetch('/auth/2fa/setup', { method: 'POST' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Failed to start MFA setup');
			setQrCodeDataUrl(data.qrCodeDataUrl);
			setSecret(data.secret);
			setEnrolling(true);
		} catch (err: any) {
			setError(err.message);
		}
	};

	const confirmEnrollment = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		try {
			const res = await authedFetch('/auth/2fa/enable', {
				method: 'POST',
				body: JSON.stringify({ token: confirmCode.trim() }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Invalid code');
			setRecoveryCodes(data.recoveryCodes);
			setEnabled(true);
			setEnrolling(false);
		} catch (err: any) {
			setError(err.message);
		}
	};

	const handleDisable = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		try {
			const res = await authedFetch('/auth/2fa/disable', {
				method: 'POST',
				body: JSON.stringify({ token: disableCode.trim() }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Invalid code');
			setEnabled(false);
			setDisabling(false);
			setDisableCode('');
		} catch (err: any) {
			setError(err.message);
		}
	};

	return (
		<div className="flex flex-col min-h-screen text-slate-800 font-sans">
			<SkipLink />
			<header id="navbar" tabIndex={-1} className="focus:outline-none">
				<Navbar />
			</header>

			<main id="main-content" tabIndex={-1} className="focus:outline-none max-w-xl w-full mx-auto p-6 flex-1 pt-24 space-y-6">
				{!adminNeedsMfa && (
					<div>
						<Button href={siteAdmin ? '/admin' : guest ? homeFor('GUEST') : '/dashboard'} variant="secondary">
							&larr; {siteAdmin ? 'Back to admin console' : guest ? 'Back to your tree' : 'Back to dashboard'}
						</Button>
					</div>
				)}
				<h1 className="text-2xl font-bold text-slate-900">Settings</h1>

				{adminNeedsMfa && (
					<div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
						<strong>Turn on MFA to continue.</strong> Site admins must use MFA. The admin console opens
						once it&apos;s set up below.
					</div>
				)}

				{guest ? (
					// A guest account is a short-lived demo login, so its account settings can't be changed.
					<section aria-labelledby="guest-heading" className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
						<h2 id="guest-heading" className="text-lg font-bold text-slate-900">
							You&apos;re using the guest account
						</h2>
						<p className="text-sm text-slate-700">
							Guest accounts are short demo logins, removed a day after your visit, so their password,
							email, MFA and deletion can&apos;t be changed. Sign up for your own free account to use these settings.
						</p>
						{/* /signup sends anyone logged in to the dashboard, so leave the guest session first. */}
						<Button onClick={() => { clearSession(); router.push('/signup'); }} variant="primary">
							Sign up
						</Button>
					</section>
				) : loading ? (
					<p aria-live="polite">Loading...</p>
				) : recoveryCodes ? (
					<section aria-labelledby="recovery-codes-heading" className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
						<h2 id="recovery-codes-heading" className="text-lg font-bold text-slate-900">
							Save your recovery codes
						</h2>
						<p className="text-sm text-slate-700">
							Store these somewhere safe. Each code can be used once to sign in if you lose access
							to your authenticator app. They will not be shown again.
						</p>
						<ul className="grid grid-cols-2 gap-2 font-mono text-sm bg-slate-100 p-4 rounded-lg" aria-label="Recovery codes">
							{recoveryCodes.map((code) => (
								<li key={code}>{code}</li>
							))}
						</ul>
						<Button
							onClick={() => (siteAdmin ? router.push('/admin') : setRecoveryCodes(null))}
							variant="primary"
						>
							{siteAdmin ? 'I\'ve saved these codes, open the admin console' : 'I\'ve saved these codes'}
						</Button>
					</section>
				) : enrolling ? (
					<section aria-labelledby="enroll-heading" className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
						<h2 id="enroll-heading" className="text-lg font-bold text-slate-900">
							Scan this QR code
						</h2>
						{qrCodeDataUrl && (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={qrCodeDataUrl} alt="Scan this QR code with your authenticator app to enable MFA" width={200} height={200} />
						)}
						{secret && (
							<p className="text-sm text-slate-700">
								Or enter this code manually: <code className="font-mono">{secret}</code>
							</p>
						)}
						<form onSubmit={confirmEnrollment} className="space-y-2">
							<label htmlFor="confirm-code" className="block text-sm font-medium text-slate-800">
								Enter the 6-digit code from your app to confirm
							</label>
							<input
								id="confirm-code"
								type="text"
								inputMode="numeric"
								value={confirmCode}
								onChange={(e) => setConfirmCode(e.target.value)}
								required
							/>
							<button type="submit">Confirm and enable MFA</button>
						</form>
						{error && <div className="error" role="alert">{error}</div>}
					</section>
				) : enabled ? (
					<section aria-labelledby="disable-heading" className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
						<h2 id="disable-heading" className="text-lg font-bold text-slate-900">
							MFA is enabled
						</h2>
						{siteAdmin ? (
							// The backend refuses it too.
							<p className="text-sm text-slate-700">Site admins must keep MFA on.</p>
						) : disabling ? (
							<form onSubmit={handleDisable} className="space-y-2">
								<label htmlFor="disable-code" className="block text-sm font-medium text-slate-800">
									Enter your current 6-digit code to disable MFA
								</label>
								<input
									id="disable-code"
									type="text"
									inputMode="numeric"
									value={disableCode}
									onChange={(e) => setDisableCode(e.target.value)}
									required
								/>
								<button type="submit">Disable MFA</button>
								{error && <div className="error" role="alert">{error}</div>}
							</form>
						) : (
							<Button onClick={() => setDisabling(true)} variant="secondary">
								Disable MFA
							</Button>
						)}
					</section>
				) : (
					<section aria-labelledby="enable-heading" className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
						<h2 id="enable-heading" className="text-lg font-bold text-slate-900">
							MFA is not enabled
						</h2>
						<p className="text-sm text-slate-700">
							Add an extra layer of security to your account using an authenticator app (e.g. Google
							Authenticator, Authy, 1Password).
						</p>
						<Button onClick={startEnrollment} variant="primary">
							Enable MFA
						</Button>
						{error && <div className="error" role="alert">{error}</div>}
					</section>
				)}

				{!guest && !adminNeedsMfa && !loading && !recoveryCodes && !enrolling && <ChangePasswordForm />}
				{!guest && !adminNeedsMfa && !loading && !recoveryCodes && !enrolling && <ChangeEmailForm />}
				{!guest && !siteAdmin && !loading && !recoveryCodes && !enrolling && <DeleteAccountForm />}
				{siteAdmin && !adminNeedsMfa && !loading && !recoveryCodes && !enrolling && (
					// The backend refuses it too: there must always be an admin left.
					<section aria-labelledby="admin-delete-heading" className="bg-white p-6 rounded-lg border border-slate-200 space-y-2">
						<h2 id="admin-delete-heading" className="text-lg font-bold text-slate-900">Delete account</h2>
						<p className="text-sm text-slate-700">
							A site admin can&apos;t delete their own account. Another admin can remove it on the Admins tab.
						</p>
					</section>
				)}
			</main>

			<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
				<Footer />
			</footer>
		</div>
	);
}
