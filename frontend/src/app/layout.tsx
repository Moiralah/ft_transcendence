import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { SessionShare } from '@/components/sessionShare';
import { AppPresence } from '@/hooks/usePresence';
import './globals.css';

// Every page is rendered per request, so it gets that request's CSP nonce
// (src/middleware.ts). A page built once at build time would have none, and
// the browser would refuse its scripts.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
	// Each route sets its own title (WCAG 2.4.2); "%s" is that title.
	title: { default: 'Family Tree', template: '%s · Family Tree' },
	description: 'A minimalist family tree starter',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<SessionShare />
				<AppPresence />
				{children}
				<Toaster position="bottom-right" />
			</body>
		</html>
	);
}
