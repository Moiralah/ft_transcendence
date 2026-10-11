import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { SessionShare } from '@/components/sessionShare';
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
				{children}
				<Toaster position="bottom-right" />
			</body>
		</html>
	);
}
