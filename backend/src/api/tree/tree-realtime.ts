import { Logger } from '@nestjs/common';
import { createHmac } from 'crypto';

const logger = new Logger('TreeRealtime');

// The Supabase Realtime channel for one tree: live audit notifications and
// who's online (frontend hooks/notification.ts and hooks/useTreePresence.ts).
//
// The browser has no Supabase login (the backend issues its own JWT), so these
// are public channels: anyone with the anon key, which ships in the frontend,
// can join any channel whose name they know. The name therefore ends in an
// HMAC that only the backend can compute, and it is only handed out with the
// tree itself, which is members-only (getTreeById / getTreeBySlug).
//
// Before 14 Oct the browser listened to INSERTs on the AuditLog table
// instead, and the presence channel was `tree-presence-<treeId>`: every
// visitor got every tree's audit rows and could join any tree's presence.
// RLS on the public tables (turned on 14 Oct) cut the table feed off; this
// replaces it. Never add an RLS policy on AuditLog to bring that feed back.
export function treeChannel(treeId: number): string {
	const secret = process.env.JWT_SECRET;
	if (!secret) throw new Error('JWT_SECRET is not set');
	const sig = createHmac('sha256', secret).update(`tree-channel:${treeId}`).digest('hex').slice(0, 32);
	return `tree-${treeId}-${sig}`;
}

export interface AuditEvent {
	id: number;
	treeId: number;
	profileId: number;
	action: string;
	details: string | null;
	createdAt: Date;
}

// Sends one audit row to its tree's channel through Realtime's REST broadcast
// endpoint, with the service role key. Fire and forget: a missed toast must
// never fail the action that wrote the log.
export function broadcastAudit(log: AuditEvent): void {
	const url = process.env.SUPABASE_AUTH_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) return;

	fetch(`${url}/realtime/v1/api/broadcast`, {
		method: 'POST',
		headers: {
			apikey: key,
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			messages: [{ topic: treeChannel(log.treeId), event: 'audit', payload: log, private: false }],
		}),
	})
		.then((res) => {
			if (!res.ok) logger.warn(`Broadcast for tree ${log.treeId} failed: HTTP ${res.status}`);
		})
		.catch((err) => logger.warn(`Broadcast for tree ${log.treeId} failed: ${err.message}`));
}
