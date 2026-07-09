import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Family Tree',
  description: 'A minimal family tree starter',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
