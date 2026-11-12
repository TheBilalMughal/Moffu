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

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Moffu',
  url: 'https://www.moffu.pro',
  logo: 'https://www.moffu.pro/images/logo-transparent.png',
  sameAs: [
    'https://linkedin.com/company/moffu',
    'https://x.com/moffu',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@moffu.pro',
    contactType: 'customer support',
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Moffu',
  url: 'https://www.moffu.pro',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
