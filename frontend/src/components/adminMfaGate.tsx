'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_MFA_SETUP_PATH, getToken } from '@/lib/auth';

// Site admins must have MFA; the backend refuses the admin console until it's
// on. This sends an admin without it to Settings before the console loads,
// instead of showing a page of refused requests.
export function AdminMfaGate({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const token = getToken();
		// No session: straight to staff sign-in, without drawing any of the
		// console first (the session is per-tab, so a pasted /admin link in a
		// new browser or tab lands here).
		if (!token) {
			router.replace('/staff');
			return;
		}
		fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/2fa/status`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data && data.enabled === false) router.replace(ADMIN_MFA_SETUP_PATH);
				else setReady(true);
			})
			.catch(() => setReady(true));
	}, [router]);

	return ready ? <>{children}</> : null;
}
