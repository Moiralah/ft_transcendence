import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { SessionShare } from '@/components/sessionShare';
import { AppPresence } from '@/hooks/usePresence';
import './globals.css';

export const metadata: Metadata = {
	title: 'Family Tree',
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
