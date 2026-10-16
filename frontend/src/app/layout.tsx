import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { StatusSegment } from "../components/statusSegment";
import './globals.css';

export const metadata: Metadata = {
	title: 'Family Tree',
	description: 'A minimalist family tree starter',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
                <StatusSegment>
                  {children}
                </StatusSegment>
				<Toaster position="bottom-right" />
			</body>
		</html>
	);
}
