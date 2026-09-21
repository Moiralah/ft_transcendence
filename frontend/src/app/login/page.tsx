
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { exchangeSupabaseToken, isTwoFactorRequired, storeSession } from '@/lib/auth';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { TwoFactorPrompt } from '@/components/twoFactorPrompt';

export default function LoginPage() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [challengeToken, setChallengeToken] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	// The reset-password page sends people back here with ?reset=1.
	useEffect(() => {
		if (new URLSearchParams(window.location.search).get('reset')) {
			setNotice('Password updated. Please sign in with your new password.');
		}
	}, []);

	const handleOAuthLogin = async (provider: 'google' | 'github') => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: `${window.location.origin}/consent`,
			},
		});
		if (error) setError(error.message);
	};

	// Also allow email/password for development (optional)
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const handleEmailLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) setError(error.message);
		else {
			// After successful login, send token to backend
			await sendTokenToBackend(data.session.access_token);
		}
	};

	const sendTokenToBackend = async (accessToken: string) => {
		try {
			const result = await exchangeSupabaseToken(accessToken);
			if (isTwoFactorRequired(result)) {
				setChallengeToken(result.challengeToken);
				return;
			}
			storeSession(result);
			router.push('/dashboard');
		} catch (err: any) {
			setError(err.message || 'Login failed');
		}
	};

	return (
	    <div className="flex flex-col min-h-screen text-slate-800 font-sans">
      		<SkipLink />
    		<header>
      			<Navbar />
    		</header>
    		<main className="flex flex-1 ">
				<div className="card">
					<h1>Login</h1>
					<hr />
					{challengeToken ? (
						<TwoFactorPrompt
							challengeToken={challengeToken}
							onVerified={() => router.push('/dashboard')}
						/>
					) : (
						<>
							<form onSubmit={handleEmailLogin} className="mb-3">
								<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
								<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
								<button type="submit">Sign in with email</button>
							</form>
							{notice && <div className="success" role="status">{notice}</div>}
							{error && <div className="error">{error}</div>}
							<p className="text-sm mb-3">
								<Link href="/forgot-password" className="underline">Forgot password?</Link>
							</p>
							<div  className="flex flex-col gap-3 ">
								<button onClick={() => handleOAuthLogin('google')}>Sign in with Google</button>
								<button onClick={() => handleOAuthLogin('github')}>Sign in with GitHub</button>
							</div>
						</>
					)}
				</div>
		    </main>
      		<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
        		<Footer/>
      		</footer>
    	</div>
	);
}
