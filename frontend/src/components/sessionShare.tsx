'use client';

import { useEffect } from 'react';
import { answerSessionRequests } from '@/lib/auth';

// Mounted once in the root layout: lets a logged-in tab hand its session to a
// newly opened tab of the same site (see borrowSessionFromOtherTab in lib/auth).
export function SessionShare() {
	useEffect(() => answerSessionRequests(), []);
	return null;
}
