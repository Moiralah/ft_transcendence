'use client';

import { useEffect, useState } from 'react';

// Shown on the front page when a guest's session was removed after 15 minutes
// without activity (lib/auth.ts loginPathAfter401 sends them to /?guest=ended).
export function GuestEndedNotice() {
	const [show, setShow] = useState(false);
	useEffect(() => {
		setShow(new URLSearchParams(window.location.search).get('guest') === 'ended');
	}, []);
	if (!show) return null;
	return (
		<div role="status" className="mx-auto mt-24 -mb-16 w-full max-w-2xl px-6">
			<p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 text-center">
				Your guest session ended after 15 minutes without activity, and its demo tree was removed.
				Try as guest again for a fresh one, or sign up to keep your tree.
			</p>
		</div>
	);
}
