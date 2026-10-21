'use client';

import { useEffect } from 'react';
import { watchSessionExpiry, watchSessionInOtherTabs } from '@/lib/auth';

// Mounted once in the root layout. Every tab shares one session (the HttpOnly
// cookie), so a tab follows when another one signs out or in as someone else,
// and leaves a signed-in page when the session's hour is up.
export function SessionShare() {
	useEffect(() => {
		const stopTabs = watchSessionInOtherTabs();
		const stopExpiry = watchSessionExpiry();
		return () => {
			stopTabs();
			stopExpiry();
		};
	}, []);
	return null;
}
