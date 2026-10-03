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

export function useTreePresence(treeId: number | null, me: PresenceUser | null) {
	const [onlineProfiles, setOnlineProfileIds] = useState<PresenceUser[]>([]);

	useEffect(() => {
		if (!treeId || !me?.profileId) return;

		const channel = supabase.channel(`tree-presence-${treeId}`, {
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

	}, [treeId, me?.profileId]);

	const onlineProfileIds = new Set(onlineProfiles.map((u) => u.profileId));

	return { onlineProfiles, onlineProfileIds };
}
