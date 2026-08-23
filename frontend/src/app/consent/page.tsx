'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
	const router = useRouter();

	useEffect(() => {
		const handleCallback = async () => {
			const { data, error } = await supabase.auth.getSession();
			if (error) {
				console.error(error);
				router.push('/login?error=SessionError');
				return;
			}
			if (data.session) {
				// Send token to backend
				const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ accessToken: data.session.access_token }),
				});
				const result = await res.json();
				if (res.ok) {
					localStorage.setItem('ft_token', result.accessToken);
					router.push('/dashboard');
				} else {
					router.push('/login?error=BackendError');
				}
			}
		};
		handleCallback();
	}, [router]);

	return <div>Processing login...</div>;
}
