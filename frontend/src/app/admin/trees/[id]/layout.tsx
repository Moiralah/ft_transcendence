import type { Metadata } from 'next';

// The pages are client components, so their titles are set here (WCAG 2.4.2).
export const metadata: Metadata = { title: 'Tree details' };

export default function Layout({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
