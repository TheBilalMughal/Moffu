import Link from 'next/link';

const portalUrl = process.env.PORTAL_URL ?? 'https://app.moffu.pro';

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-black/[0.06]">
      <div className="w-full px-6 lg:px-14 h-16 flex items-center justify-between gap-8">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <span className="text-2xl font-black text-[#111827] tracking-tight">moffu.</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          <Link href="/#how-it-works" className="text-sm font-medium text-[#111827]/60 hover:text-[#111827] transition-colors">
            how it works
          </Link>
          <Link href="/feature" className="text-sm font-medium text-[#111827]/60 hover:text-[#111827] transition-colors">
            features
          </Link>
          <Link href="/#pricing" className="text-sm font-medium text-[#111827]/60 hover:text-[#111827] transition-colors">
            pricing
          </Link>
          <Link href="/#faq" className="text-sm font-medium text-[#111827]/60 hover:text-[#111827] transition-colors">
            faqs
          </Link>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-5">
          <a href={`${portalUrl}/auth/login`} className="hidden md:block text-sm font-medium text-[#374151] hover:text-[#111827] transition-colors">
            Log in
          </a>
          <a
            href={`${portalUrl}/auth/signup`}
            className="text-sm font-semibold bg-[#111827] text-white px-5 py-2.5 rounded-lg hover:opacity-85 transition-colors"
          >
            Start Free →
          </a>
        </div>
      </div>
    </header>
  );
}
