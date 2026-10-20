import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

type AuditLog = {
	id: number;
	treeId: number;
	actorName: string;
	action: string;
	details: string | null;
	createdAt: string;
};

// `channel` is the tree's realtimeChannel from GET /trees/slug/:slug (members
// only). The backend broadcasts every audit row there; see
// backend/src/api/tree/tree-realtime.ts for why it isn't a table subscription.
export function useTreeNotifications(
	channel: string | null,
	onTreeChange?: () => void,
) {
	const onTreeChangeRef = useRef(onTreeChange);

	useEffect(() => {
		onTreeChangeRef.current = onTreeChange;
	}, [onTreeChange]);

	useEffect(() => {
		if (!channel) return;

		const sub = supabase
			.channel(channel)
			.on('broadcast', { event: 'audit' }, ({ payload }) => {
				const log = payload as AuditLog;
				// Show a toast notification
				const message = formatNotification(log);
				toast.success(message, {
					duration: 7000,
					position: 'bottom-right',
				});
				onTreeChangeRef.current?.();
			})
			.subscribe();

		return () => {
			supabase.removeChannel(sub);
		};
	}, [channel]);
}

function formatNotification(log: AuditLog): string {
	const who = log.actorName || 'Someone';
	switch (log.action) {
		case 'CREATE_TREE':
			return `🌳 ${who} created a tree: ${log.details ?? ''}`;
		case 'JOIN_TREE':
			return `👤 ${who} joined the tree`;
		case 'ADD_CHILD':
			return `👶 ${who}: ${log.details ?? 'added a child'}`;
		case 'ADD_SPOUSE':
			return `💍 ${who}: ${log.details ?? 'added a spouse'}`;
		case 'UPDATE_ROLE':
			return `🔧 ${who}: ${log.details ?? 'changed a role'}`;
		case 'DELETE_PROFILE':
			return `🗑️ ${who}: ${log.details ?? 'removed a profile'}`;
		case 'REQUEST_CLAIM':
			return `🙋 ${who} requested a claim: ${log.details ?? ''}`;
		case 'APPROVE_CLAIM':
			return `✅ ${who}: ${log.details ?? 'approved a claim'}`;
		case 'REJECT_CLAIM':
			return `❌ ${who}: ${log.details ?? 'rejected a claim'}`;
		case 'LEAVE_TREE':
			return `👋 ${who} left the tree`;
		case 'UPDATE_TREE':
			return `✏️ ${who}: ${log.details ?? 'updated the tree'}`;
		case 'UNCLAIM':
			return `↩️ ${who}: ${log.details ?? 'unclaimed a profile'}`;
		case 'UPDATE_PROFILE':
			return `📝 ${who}: ${log.details ?? 'updated a profile'}`;
		case 'KICK_USER':
			return `👢 ${who}: ${log.details ?? 'removed a member'}`;
		default:
			return `📢 ${log.action}: ${log.details ?? ''}`;
	}
}
