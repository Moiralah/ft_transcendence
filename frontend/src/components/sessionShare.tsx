'use client';

import { useEffect } from 'react';
import { watchSessionInOtherTabs } from '@/lib/auth';

// Mounted once in the root layout. Every tab shares one session (the HttpOnly
// cookie), so a tab follows when another one signs out or in as someone else.
export function SessionShare() {
	useEffect(() => watchSessionInOtherTabs(), []);
	return null;
}
