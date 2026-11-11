import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.moffu.pro'),
  title: {
    default: 'AI Google Review Reply Software | Moffu',
    template: '%s | Moffu',
  },
  description: 'Reply to every Google Business Profile review in your brand voice. Moffu drafts on-brand replies you approve in one click. Start free, no credit card required.',
  icons: { icon: '/images/fevicon.png', shortcut: '/images/fevicon.png' },
  openGraph: {
    siteName: 'Moffu',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@moffu',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
