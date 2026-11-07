import Link from 'next/link';

const portalUrl = process.env.PORTAL_URL ?? 'https://app.moffu.pro';

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-black/8">
      <div className="w-full px-6 lg:px-12 h-14 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 bg-[#0D4C3C] rounded flex items-center justify-center">
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none" aria-hidden="true">
              <path d="M1 9V1l5.5 5.5L12 1v8" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-bold text-[#111827] tracking-tight">moffu.</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
          <Link href="/#how-it-works" className="text-xs font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
            how it works
          </Link>
          <Link href="/feature" className="text-xs font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
            features
          </Link>
          <Link href="/#pricing" className="text-xs font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
            pricing
          </Link>
          <Link href="/#faq" className="text-xs font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
            faqs
          </Link>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <a href={`${portalUrl}/auth/login`} className="hidden md:block text-xs font-medium text-[#374151] hover:text-[#111827] transition-colors">
            Log in
          </a>
          <a
            href={`${portalUrl}/auth/signup`}
            className="text-xs font-semibold bg-[#111827] text-white px-4 py-2 rounded-lg hover:bg-[#1f2937] transition-colors"
          >
            Start Free →
          </a>
        </div>
      </div>
    </header>
  );
}
