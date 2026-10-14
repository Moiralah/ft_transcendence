"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface PresenceUser {
	profileId: number;
	firstName?: string;
	lastName?: string;
	photoUrl?: string | null;
	onlineAt: string;
}

// `channelName` is the tree's realtimeChannel from GET /trees/slug/:slug (members
// only), so outsiders can't see or join who's online (presence joins
// `<channelName>-presence`); see
// backend/src/api/tree/tree-realtime.ts.
export function useTreePresence(channelName: string | null, me: PresenceUser | null) {
	const [onlineProfiles, setOnlineProfileIds] = useState<PresenceUser[]>([]);

	useEffect(() => {
		if (!channelName || !me?.profileId) return;

		// Its own channel, not the notifications one: supabase.channel() returns
		// the already-subscribed channel for a name in use, and adding presence
		// callbacks to it throws, which crashed the whole canvas page. The suffix
		// keeps the secret HMAC part of the name.
		const channel = supabase.channel(`${channelName}-presence`, {
			config: { presence: { key: String(me.profileId) } },
		});

		channel
			.on('presence', { event: 'sync' }, () => {
				const state = channel.presenceState<PresenceUser>();
				// Each key can hold more than one entry if the same profile has
				// multiple tabs/devices open — just take the latest one per key.

				const users = Object.values(state).map((entries) => entries[entries.length - 1])
				setOnlineProfileIds(users);
			})
			.subscribe(async (status) => {
				if (status === 'SUBSCRIBED') {
					await channel.track({ ...me, onlineAt: new Date().toISOString() });
				}
			});

		return () => {
			supabase.removeChannel(channel);
		};
		// Only re-subscribe if the tree or the actual profileId changes, not on
		// every render where `me` is a fresh object literal.

	}, [channelName, me?.profileId]);

	const onlineProfileIds = new Set(onlineProfiles.map((u) => u.profileId));

	return { onlineProfiles, onlineProfileIds };
}
