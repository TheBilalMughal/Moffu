import Link from 'next/link';

function LogoMark() {
  return (
    <div className="w-8 h-8 bg-[#0D4C3C] rounded-lg flex items-center justify-center flex-shrink-0">
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
        <path d="M1 13V1l8 8L17 1v12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? '';

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
      <div className="w-full px-8 lg:px-16 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-semibold text-[#111827] text-[15px]">Moffu</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          <Link href="/#product" className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150">
            Product
          </Link>
          <Link href="/#how-it-works" className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150">
            Features
          </Link>
          <Link href="/#how-it-works" className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150">
            How It Works
          </Link>
          <Link href="/#pricing" className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-5">
          <a
            href={`${portalUrl}/auth/login`}
            className="text-sm text-[#374151] hover:text-[#111827] transition-colors duration-150"
          >
            Login
          </a>
          <a
            href={`${portalUrl}/auth/signup`}
            className="text-sm bg-[#0D4C3C] hover:bg-[#083F32] text-white px-5 py-2.5 rounded-lg font-medium transition-colors duration-150"
          >
            Get Started
          </a>
        </div>
      </div>
    </header>
  );
}
