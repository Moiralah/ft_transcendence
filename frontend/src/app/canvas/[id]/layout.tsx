import type { Metadata } from 'next';

// The page is a client component, so its title is set here (WCAG 2.4.2).
export const metadata: Metadata = { title: 'Tree' };

export default function Layout({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
