"use client";

import { PresenceUser } from '@/hooks/useTreePresence';

function initials(u: PresenceUser): string {
	return (`${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`).toUpperCase() || '?';
}

export function PresenceFacepile({ users }: { users: PresenceUser[] }) {
	if (users.length === 0) return null;

	const shown = users.slice(0, 5);
	const overflow = users.length - shown.length;

	return (
		<div className="fixed top-4 right-4 z-40 flex -space-x-3">
			{shown.map((u) => (
				<div
					key={u.profileId}
					title={`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Someone'}
					className="w-9 h-9 rounded-full border-2 border-green-300 shadow bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-700 overflow-hidden"
				>
					{u.photoUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
					) : (
						initials(u)
					)}
				</div>
			))}
			{overflow > 0 && (
				<div className="w-9 h-9 rounded-full border-2 border-white shadow bg-gray-700 text-white flex items-center justify-center text-xs font-semibold">
					+{overflow}
				</div>
			)}
		</div>
	);
}
