import type { Metadata } from 'next';
import { AdminMfaGate } from '@/components/adminMfaGate';

// The moderation console: the admin console's Users and Trees pages, for
// MODERATOR sessions (AdminShell checks the role). Moderators sign in on
// /login, and need MFA here like admins do.
export const metadata: Metadata = { title: 'Moderation' };

export default function Layout({ children }: { children: React.ReactNode }) {
	return <AdminMfaGate signInPath="/login">{children}</AdminMfaGate>;
}
