import type { Metadata } from 'next';
import { Source_Sans_3, Syne } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Client Portal',
  description: 'Client portal for warehouse inventory, orders, and inbound',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sourceSans.variable} ${syne.variable} portal-atmosphere font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
