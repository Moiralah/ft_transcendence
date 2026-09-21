
import { useEffect , useRef} from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

type AuditLog = {
	id: number;
	treeId: number;
	profileId: string;
	action: string;
	details: string | null;
	createdAt: string;
};

interface MemberLike {
	profileId: number;
	firstName?: string;
	lastName?: string;
}

export function useTreeNotifications(treeId: number | null, members: MemberLike[] = []) {
	const membersRef = useRef(members);
	useEffect(() => {
		membersRef.current = members;
	}, [members]);

	useEffect(() => {
		if (!treeId) return;

		const channel = supabase
			.channel(`auditlog:tree:${treeId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'AuditLog',
					filter: `treeId=eq.${treeId}`,
				},
				(payload) => {
					const log = payload.new as AuditLog;
					// Show a toast notification
					const message = formatNotification(log, membersRef.current);
					toast.success(message, {
						duration: 4000,
						position: 'bottom-right',
					});
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [treeId]);
}

function actorName(profileId: number, members: MemberLike[]): string {
	const member = members.find((m) => m.profileId === profileId);
	const name = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim();
	return name || 'Someone';
}

function formatNotification(log: AuditLog, members: MemberLike[]): string {
	const who = actorName(Number(log.profileId), members);
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
			return `✅ ${who} approved a claim request`;
		case 'REJECT_CLAIM':
			return `❌ ${who} rejected a claim request`;
		case 'LEAVE_TREE':
			return `👋 ${who} left the tree`;
		default:
			return `📢 ${log.action}: ${log.details ?? ''}`;
	}
}
