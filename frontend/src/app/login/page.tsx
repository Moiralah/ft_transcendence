
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

import { SkipLink } from '@/components/SkipLink';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export default function LoginPage() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);

	const handleOAuthLogin = async (provider: 'google' | 'github') => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: `${window.location.origin}/auth/callback`,
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
		const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accessToken }),
		});
		const data = await res.json();
		if (res.ok) {
			localStorage.setItem('ft_token', data.accessToken);
			router.push('/tree');
		} else {
			setError(data.message || 'Login failed');
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
					<form onSubmit={handleEmailLogin} className="mb-3">
						<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
						<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
						<button type="submit">Sign in with email</button>
					</form>
					{error && <div className="error">{error}</div>}
					<div  className="flex flex-col gap-3 ">
						<button onClick={() => handleOAuthLogin('google')}>Sign in with Google</button>
						<button onClick={() => handleOAuthLogin('github')}>Sign in with GitHub</button>
					</div>
				</div>
		    </main>
      		<footer id="footer" tabIndex={-1} className="focus:outline-none mt-auto">
        		<Footer/>
      		</footer>
    	</div>
	);
}
