"use client";

import Link from 'next/link';
import { PresenceUser } from '@/hooks/useTreePresence';

function initials(u: PresenceUser): string {
	return (`${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`).toUpperCase() || '?';
}

const circle = "w-9 h-9 rounded-full border-2 border-green-300 shadow bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-700 overflow-hidden";

function Face({ u }: { u: PresenceUser }) {
	return u.photoUrl ? (
		// eslint-disable-next-line @next/next/no-img-element
		<img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
	) : (
		<>{initials(u)}</>
	);
}

// Who's online in this tree. Your own circle links back to the dashboard;
// the others only show a name on hover.
export function PresenceFacepile({ users, meId }: { users: PresenceUser[]; meId?: number | null }) {
	if (users.length === 0) return null;

	// You first, so your circle is always shown even with more than 5 online.
	const ordered = [...users].sort((a, b) => Number(b.profileId === meId) - Number(a.profileId === meId));
	const shown = ordered.slice(0, 5);
	const overflow = users.length - shown.length;

	return (
		<div className="fixed top-4 right-4 z-40 flex -space-x-3">
			{shown.map((u) => {
				const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Someone';
				return u.profileId === meId ? (
					<Link
						key={u.profileId}
						href="/dashboard"
						title="You · back to dashboard"
						aria-label="Back to dashboard"
						className={`${circle} hover:ring-2 hover:ring-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-600`}
					>
						<Face u={u} />
					</Link>
				) : (
					<div key={u.profileId} title={name} className={circle}>
						<Face u={u} />
					</div>
				);
			})}
			{overflow > 0 && (
				<div className="w-9 h-9 rounded-full border-2 border-white shadow bg-gray-700 text-white flex items-center justify-center text-xs font-semibold">
					+{overflow}
				</div>
			)}
		</div>
	);
}
