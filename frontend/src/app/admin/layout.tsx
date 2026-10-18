import type { Metadata } from 'next';
import { AdminMfaGate } from '@/components/adminMfaGate';

// The pages are client components, so their titles are set here (WCAG 2.4.2).
export const metadata: Metadata = { title: 'Admin console' };

export default function Layout({ children }: { children: React.ReactNode }) {
	return <AdminMfaGate>{children}</AdminMfaGate>;
}
