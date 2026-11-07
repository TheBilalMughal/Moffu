import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'Moffu — AI Review Agent',
    template: '%s | Moffu',
  },
  description: 'Brand-trained AI reputation agent for Google Business Profile.',
  icons: { icon: '/images/fevicon.png', shortcut: '/images/fevicon.png' },
  robots: {
    index: false,
    follow: false,
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
