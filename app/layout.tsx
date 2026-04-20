import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ANTP',
  description: 'ANTP: Watch YouTube with long-distance friends in perfect sync, with live video calls and chat.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
